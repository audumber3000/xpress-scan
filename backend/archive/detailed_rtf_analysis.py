#!/usr/bin/env python3
"""
Detailed RTF analysis to extract exact styling information
"""

import re

def detailed_rtf_analysis():
    """Perform detailed RTF analysis"""
    print("🔍 Detailed RTF Analysis...")
    
    try:
        # Read the RTF file
        with open('template_original.rtf', 'r', encoding='utf-8') as file:
            rtf_content = file.read()
        
        print(f"📄 RTF file size: {len(rtf_content)} characters")
        
        # Extract color table
        color_table_match = re.search(r'\\colortbl\s*\{([^}]+)\}', rtf_content)
        if color_table_match:
            color_table = color_table_match.group(1)
            print(f"\n🎨 Color Table:")
            print(color_table)
        
        # Extract font table
        font_table_match = re.search(r'\\fonttbl\s*\{([^}]+)\}', rtf_content)
        if font_table_match:
            font_table = font_table_match.group(1)
            print(f"\n📝 Font Table:")
            print(font_table)
        
        # Look for specific formatting patterns
        print(f"\n📊 Formatting Analysis:")
        
        # Find all color references
        color_refs = re.findall(r'\\cf(\d+)', rtf_content)
        unique_colors = set(color_refs)
        print(f"   Colors used: {sorted(unique_colors)}")
        
        # Find all font references
        font_refs = re.findall(r'\\f(\d+)', rtf_content)
        unique_fonts = set(font_refs)
        print(f"   Fonts used: {sorted(unique_fonts)}")
        
        # Find font sizes
        font_sizes = re.findall(r'\\fs(\d+)', rtf_content)
        unique_sizes = set(font_sizes)
        print(f"   Font sizes: {sorted(unique_sizes)}")
        
        # Find alignment
        alignments = re.findall(r'\\(ql|qc|qr|qj)', rtf_content)
        unique_alignments = set(alignments)
        print(f"   Alignments: {unique_alignments}")
        
        # Find bold/italic
        bold_count = len(re.findall(r'\\b1', rtf_content))
        italic_count = len(re.findall(r'\\i1', rtf_content))
        print(f"   Bold sections: {bold_count}")
        print(f"   Italic sections: {italic_count}")
        
        # Extract the actual text content
        text_content = re.sub(r'\\[a-z]+\d*', '', rtf_content)
        text_content = re.sub(r'\{|\}', '', text_content)
        text_content = re.sub(r'\s+', ' ', text_content).strip()
        
        print(f"\n📋 Clean Text Content:")
        print("=" * 50)
        print(text_content)
        print("=" * 50)
        
        return {
            'colors': sorted(unique_colors),
            'fonts': sorted(unique_fonts),
            'sizes': sorted(unique_sizes),
            'alignments': unique_alignments,
            'text': text_content
        }
        
    except Exception as e:
        print(f"❌ Error in detailed analysis: {e}")
        return None

if __name__ == "__main__":
    result = detailed_rtf_analysis()
    if result:
        print(f"\n✅ Analysis complete!")
        print(f"Summary: {result}") 