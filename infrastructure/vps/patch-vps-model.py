#!/usr/bin/env python3
import re
p = '/root/.hermes/profiles/forge/config.yaml'
txt = open(p).read()
txt = re.sub(r'^provider:\s*nous\s*$', 'provider: openai', txt, count=1, flags=re.M)
txt = re.sub(r'^default:\s*.*$', 'default: stepfun/step-3.7-flash:free', txt, count=1, flags=re.M)
txt = re.sub(r'^base_url:\s*.*$', 'base_url: https://openrouter.ai/api/v1', txt, count=1, flags=re.M)
open(p, 'w').write(txt)
print('patched', p)
print('model block:')
for line in txt.splitlines()[:8]:
    print(line)
