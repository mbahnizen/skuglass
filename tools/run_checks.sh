#!/bin/bash
echo "=== 1. Node Syntax Checks ==="
node --check sidepanel/sidepanel.js
node --check background/service-worker.js
node --check lib/utils.js
node --check lib/compare.js
node --check lib/versions.js

echo "=== 2. Test Runner ==="
node tools/test_runner.js

echo "=== 3. addEventListener Count ==="
grep -c "addEventListener" sidepanel/sidepanel.js

echo "=== 4. CSS Class Rules Check ==="
grep -o 'class="[a-z0-9 -]*"' sidepanel/sidepanel.js \
  | sed 's/.*class="//;s/"//' | tr ' ' '\n' | sort -u \
  | while read c; do grep -qE "^\.$c\s*[,{]" sidepanel/sidepanel.css \
  || echo "NO RULE: .$c"; done

echo "=== 5. Token Leak Check ==="
grep -rn "SKULYTICS_TOKEN\|Authorization\|Bearer" sidepanel/
