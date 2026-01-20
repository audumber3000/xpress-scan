#!/usr/bin/env python3
"""
Convert logo to base64 for embedding in HTML
"""
import base64

def convert_logo_to_base64():
    """Convert the logo PNG to base64 data URL"""
    try:
        with open('templates/assets/Clinic_logo.png', 'rb') as img_file:
            img_data = base64.b64encode(img_file.read()).decode('utf-8')
            data_url = f'data:image/png;base64,{img_data}'
            
            print(data_url)
            return data_url
            
    except Exception as e:
        print(f"Error converting logo: {e}")
        return None

if __name__ == "__main__":
    convert_logo_to_base64() 