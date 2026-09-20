with open('scratch/pytest_investigation.log', 'r', encoding='utf-16') as f_in:
    content = f_in.read()
with open('scratch/pytest_investigation_utf8.log', 'w', encoding='utf-8') as f_out:
    f_out.write(content)
