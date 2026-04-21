
import re

def count_tags(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)
    
    # Find all tags
    # This is a bit naive for JSX but can help
    open_divs = len(re.findall(r'<div(?!\w)', content))
    close_divs = len(re.findall(r'</div>', content))
    
    open_motion_divs = len(re.findall(r'<motion\.div(?!\w)', content))
    close_motion_divs = len(re.findall(r'</motion\.div>', content))
    
    # Check self-closing motion.div
    self_close_motion_divs = len(re.findall(r'<motion\.div[^>]*?/>', content))
    
    print(f"Divs: Open={open_divs}, Close={close_divs}, Balance={open_divs - close_divs}")
    print(f"Motion Divs: Open={open_motion_divs}, Close={close_motion_divs}, Self-Close={self_close_motion_divs}, Balance={open_motion_divs - close_motion_divs - self_close_motion_divs}")

count_tags('/Users/macbookair15/Desktop/GastroMapNew/src/features/admin/components/LocationFormSlideOver.jsx')
