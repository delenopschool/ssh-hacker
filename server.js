const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { NodeSSH } = require('node-ssh');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error('MongoDB connection error:', err));

const ssh = new NodeSSH();

const clientSchema = new mongoose.Schema({
    clientId: String,
    friendlyName: String,
});

const Client = mongoose.model('Client', clientSchema);

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
});

const User = mongoose.model('User', userSchema);

// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 8);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to get all clients
app.get('/clients', async (req, res) => {
    try {
        const clients = await Client.find();
        res.json(clients);
    } catch (error) {
        console.error('Error getting clients:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to update friendly name
app.post('/clients/:id/friendlyname', async (req, res) => {
    try {
        const { friendlyName } = req.body;
        await Client.findByIdAndUpdate(req.params.id, { friendlyName });
        res.json({ message: 'Friendly name updated' });
    } catch (error) {
        console.error('Error updating friendly name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register client endpoint
app.post('/register-client', async (req, res) => {
    try {
        const { clientId, friendlyName } = req.body;

        // Genereer een willekeurige SSH-gebruikersnaam en veilig wachtwoord
        const sshUsername = `user_${crypto.randomBytes(4).toString('hex')}`;
        const sshPassword = crypto.randomBytes(12).toString('hex');

        // Maak een nieuwe client aan en sla deze op
        const newClient = new Client({ clientId, friendlyName, sshUsername, sshPassword });
        await newClient.save();

        // Roep de functie aan om een SSH-gebruiker aan te maken op de clientmachine
        await createSSHUser(newClient);

        res.status(201).json({
            message: 'Client registered successfully',
            clientId: newClient._id,
            sshUsername,
            sshPassword
        });
    } catch (error) {
        console.error('Error registering client:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function createSSHUser(client) {
    try {
        await ssh.connect({
            host: client.clientId,
            username: 'admin', // Admin account nodig om gebruikers aan te maken
            password: process.env.ADMIN_PASSWORD
        });

        // Voeg een nieuwe SSH-gebruiker toe
        await ssh.execCommand(`sudo useradd -m -s /bin/bash ${client.sshUsername}`);
        await ssh.execCommand(`echo "${client.sshUsername}:${client.sshPassword}" | sudo chpasswd`);
        await ssh.execCommand(`sudo usermod -aG sudo ${client.sshUsername}`);

        console.log(`SSH User Created: ${client.sshUsername}`);
    } catch (error) {
        console.error('Error creating SSH user:', error);
    }
}


// Verwijder client endpoint
app.delete('/clients/:id', async (req, res) => {
    try {
        const objectId = mongoose.Types.ObjectId(req.params.id);
        await Client.findByIdAndDelete(objectId);
        res.json({ message: 'Client verwijderd' });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/clients/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client.html'));
});

// Verwijder alle clients endpoint
app.delete('/delete-all-clients', async (req, res) => {
    try {
        await Client.deleteMany({});
        res.json({ message: 'Alle clients verwijderd' });
    } catch (error) {
        console.error('Error deleting clients:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// SSH Endpoints
app.post('/clients/:id/shutdown', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        await ssh.connect({
            host: client.clientId,
            username: client.sshUsername,
            password: client.sshPassword
        });

        const result = await ssh.execCommand('shutdown -s');
        res.json({ message: 'Shutdown command executed', output: result.stdout });
    } catch (error) {
        console.error('Failed to execute shutdown command:', error);
        res.status(500).json({ error: 'Failed to execute command', details: error.message });
    }
});

app.post('/clients/:id/reboot', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        await ssh.connect({
            host: client.clientId,
            username: client.sshUsername,
            password: client.sshPassword
        });

        const result = await ssh.execCommand('reboot');
        res.json({ message: 'Reboot command executed', output: result.stdout });
    } catch (error) {
        console.error('Failed to execute reboot command:', error);
        res.status(500).json({ error: 'Failed to execute command', details: error.message });
    }
});

app.post('/clients/:id/openwebsite', async (req, res) => {
    try {
        const { url } = req.body;
        const client = await Client.findById(req.params.id);

        if (!url || !url.startsWith('http')) {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        await ssh.connect({
            host: client.clientId,
            username: client.sshUsername,
            password: client.sshPassword
        });

        const result = await ssh.execCommand(`start ${url}`);
        res.json({ message: `Opened website: ${url}`, output: result.stdout });
    } catch (error) {
        console.error('Failed to execute open website command:', error);
        res.status(500).json({ error: 'Failed to execute command', details: error.message });
    }
});


// Hard error endpoint
app.post('/clients/:id/raiseHardError', async (req, res) => {
    try {
        // Voer de hard error functie uit
        raise_hard_error();
        res.json({ message: 'Hard error raised' });
    } catch (error) {
        console.error('Error raising hard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function raise_hard_error() {
    exec('python3 /script.py raise_hard_error', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.json());

let clients = {}; // Opslag voor actieve clients

app.post("/register-ip", (req, res) => {
    const { client_ip } = req.body;
    clients[client_ip] = true; // Markeer als actief
    res.send({ message: "IP geregistreerd", ip: client_ip });
});

app.get("/get-clients", (req, res) => {
    res.json(clients);
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port);
});
