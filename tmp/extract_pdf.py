import glob
import os
from PyPDF2 import PdfReader

# Find the PDF file
pdf_files = glob.glob(os.path.join(r"c:\Users\emmanuel\Documents\ODSM\odsm-v2", "Bulletins*.pdf"))
if not pdf_files:
    print("ERROR: No PDF file found")
    exit(1)

pdf_path = pdf_files[0]
print(f"Reading: {pdf_path}")
print(f"File size: {os.path.getsize(pdf_path)} bytes")

reader = PdfReader(pdf_path)
num_pages = len(reader.pages)
print(f"Total pages: {num_pages}")
print("=" * 80)

output_path = os.path.join(r"c:\Users\emmanuel\Documents\ODSM\odsm-v2\tmp", "bulletin_content.txt")

with open(output_path, "w", encoding="utf-8") as f:
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        f.write(f"\n{'='*80}\n")
        f.write(f"PAGE {i+1}/{num_pages}\n")
        f.write(f"{'='*80}\n")
        if text:
            f.write(text)
        else:
            f.write("[No extractable text on this page - possibly scanned image]")
        f.write("\n")

print(f"Content extracted to: {output_path}")
file_size = os.path.getsize(output_path)
print(f"Output file size: {file_size} bytes ({file_size/1024:.1f} KB)")
