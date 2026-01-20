#!/usr/bin/env python3
"""
Script to analyze the RTF template and extract styling information
"""

from striprtf.striprtf import rtf_to_text
import re

def analyze_rtf_template():
    """Analyze the RTF template and extract styling information"""
    print("🔍 Analyzing RTF Template...")
    
    try:
        # Read the RTF file
        with open('template_original.rtf', 'r', encoding='utf-8') as file:
            rtf_content = file.read()
        
        print(f"📄 RTF file loaded (size: {len(rtf_content)} characters)")
        
        # Convert RTF to plain text to see the structure
        text_content = rtf_to_text(rtf_content)
        
        print("\n📋 Template Structure:")
        print("=" * 50)
        print(text_content)
        print("=" * 50)
        
        # Analyze RTF formatting codes
        print("\n🎨 RTF Formatting Analysis:")
        print("=" * 50)
        
        # Look for font information
        font_pattern = r'\\f\d+\\fs\d+'
        fonts = re.findall(font_pattern, rtf_content)
        if fonts:
            print(f"📝 Fonts found: {len(fonts)} instances")
            print(f"   Sample fonts: {fonts[:5]}")
        
        # Look for color information
        color_pattern = r'\\cf\d+'
        colors = re.findall(color_pattern, rtf_content)
        if colors:
            print(f"🎨 Colors found: {len(colors)} instances")
            print(f"   Sample colors: {colors[:5]}")
        
        # Look for alignment
        align_pattern = r'\\qc|\\ql|\\qr|\\qj'
        alignments = re.findall(align_pattern, rtf_content)
        if alignments:
            print(f"📐 Alignments found: {len(alignments)} instances")
            print(f"   Alignments: {alignments}")
        
        # Look for bold/italic
        bold_pattern = r'\\b\d'
        bold = re.findall(bold_pattern, rtf_content)
        if bold:
            print(f"🔤 Bold text found: {len(bold)} instances")
        
        italic_pattern = r'\\i\d'
        italic = re.findall(italic_pattern, rtf_content)
        if italic:
            print(f"📝 Italic text found: {len(italic)} instances")
        
        # Look for table information
        table_pattern = r'\\trowd|\\cell|\\row'
        tables = re.findall(table_pattern, rtf_content)
        if tables:
            print(f"📊 Table elements found: {len(tables)} instances")
        
        # Look for border information
        border_pattern = r'\\brdr|\\box'
        borders = re.findall(border_pattern, rtf_content)
        if borders:
            print(f"🖼️ Border elements found: {len(borders)} instances")
        
        print("\n✅ Analysis complete!")
        return text_content
        
    except Exception as e:
        print(f"❌ Error analyzing template: {e}")
        return None

if __name__ == "__main__":
    analyze_rtf_template() 