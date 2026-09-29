// 빌드 뒤 docs/data/*.json 스냅샷을 site/data 로 복사한다(백엔드 없이 여는 정적 배포용).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "../docs/data");
const to = resolve(here, "../site/data");
if (!existsSync(from)) {
  console.error("docs/data 가 없습니다. `python -c \"from collector.site import export_site\"` 로 먼저 내보내세요.");
  process.exit(1);
}
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log("site/data 로 스냅샷 복사 완료");
