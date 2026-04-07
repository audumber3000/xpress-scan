import requests
import json
import sys

def test():
    # Attempt to put update for an appointment
    # We will assume a valid clinic and try to get an appointment first
    resp = requests.post("http://localhost:8000/auth/login", data={"username": "admin@xpressscan.com", "password": "password"})
    if resp.status_code != 200:
        print("Login failed:", resp.text)
        return
    
    token = resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all appointments
    resp = requests.get("http://localhost:8000/appointments", headers=headers)
    if resp.status_code != 200:
        print("Failed to get appointments:", resp.text)
        return
        
    apts = resp.json()
    if not apts:
        print("No appointments to test with")
        return
        
    apt = apts[-1] # pick last
    print("Testing with appointment:", apt['id'])
    
    put_data = {
        "status": "checking"
    }
    resp = requests.put(f"http://localhost:8000/appointments/{apt['id']}", headers=headers, json=put_data)
    print("PUT response:", resp.status_code, resp.text)

if __name__ == "__main__":
    test()
