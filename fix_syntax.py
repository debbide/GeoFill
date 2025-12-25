import re

with open(r'e:\ck\docker\chajian\popup\popup.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找有问题的模式并修复
# 问题是 \r\n 被当作字符串字面量而不是换行
old_pattern = r"elements\.clearHistory = document\.getElementById\('clearHistory'\); \\r\\n    // Geoapify 元素\\r\\n    elements\.geoapifyKey = document\.getElementById\('geoapifyKey'\);"

new_text = """elements.clearHistory = document.getElementById('clearHistory');
    // Geoapify 元素
    elements.geoapifyKey = document.getElementById('geoapifyKey');"""

content = re.sub(old_pattern, new_text, content)

with open(r'e:\ck\docker\chajian\popup\popup.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')
