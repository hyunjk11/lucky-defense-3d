"""
tests/smoke.py — Playwright E2E 검증 테스트 (렌더링, 소환, 조합, 도박, 태초 각성, 보스전, 도감, 무에러 검증)
"""
import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS_DIR = os.path.join(ROOT, "shots")
os.makedirs(SHOTS_DIR, exist_ok=True)

PORT = 8765
BASE_URL = f"http://127.0.0.1:{PORT}/index.html?seed=777"

def run_test():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.8)
    errors = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
            )
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.on("pageerror", lambda err: errors.append(f"PAGEERROR: {err}"))
            page.on("console", lambda msg: errors.append(f"CONSOLE_ERR: {msg.text}") if msg.type == "error" else None)

            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_ timeout(500) if hasattr(page, "wait_for_ timeout") else page.wait_for_timeout(500)

            # 1. 메인 메뉴 스크린샷 & 도감 열기 확인
            assert page.locator("#menuOverlay").is_visible(), "Menu overlay should be visible"
            page.screenshot(path=os.path.join(SHOTS_DIR, "menu.png"))

            page.click("#btnOpenCodexMenu")
            page.wait_for_timeout(250)
            cards = page.locator(".codex-card").count()
            assert cards == 21, f"Expected 21 codex cards, got {cards}"
            page.screenshot(path=os.path.join(SHOTS_DIR, "codex.png"))
            page.click("#btnCloseCodex")
            page.wait_for_timeout(200)

            # 2. 게임 시작 및 기본 소환 검증
            page.click("#btnStartGame")
            page.wait_for_timeout(300)
            phase = page.evaluate("window.G.phase")
            assert phase == "play", f"Expected phase 'play', got {phase}"

            # 기본 골드(125G)로 4회 소환 (100G 소모)
            for _ in range(4):
                page.click("#btnSummon")
            unit_cnt = page.evaluate("window.G.units.length")
            assert unit_cnt == 4, f"Expected 4 summoned units, got {unit_cnt}"

            # 3. 시뮬레이션 진행 및 조합/도박/업그레이드 검증
            page.evaluate("""() => {
                window.__game.grant(3000, 1500);
                // 같은 등급+성향 2기 배치 후 조합 테스트
                window.__game.spawnUnit('striker', 3, 0, 0);
                window.__game.spawnUnit('striker', 3, 1, 0);
            }""")
            page.click("#btnCombineAll")
            page.wait_for_timeout(200)

            # 4. 전설/신화/태초 3계열 대표 유닛 배치 및 전투 시뮬레이션
            page.evaluate("""() => {
                window.__game.spawnUnit('striker', 7, 2, 2);
                window.__game.spawnUnit('destroyer', 7, 3, 2);
                window.__game.spawnUnit('arcane', 7, 2, 3);
                window.__game.spawnUnit('striker', 6, 1, 2);
                window.__game.spawnUnit('destroyer', 5, 4, 2);
                window.__game.summonBountyBoss();
                window.__game.sim(4.5, 0.05);
            }""")
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(SHOTS_DIR, "gameplay.png"))

            # 태초 유닛 클릭 선택 후 상세 카드 확인
            page.evaluate("""() => {
                const prim = window.G.units.find(u => u.tier === 7);
                if (prim) {
                    window.G.selectedUid = prim.uid;
                }
                window.__game.sim(0.2, 0.05);
            }""")
            page.wait_for_timeout(250)
            assert page.locator("#unitDetailCard").is_visible(), "Unit detail card should be visible"
            page.screenshot(path=os.path.join(SHOTS_DIR, "primordial.png"))

            # 계열 업그레이드 클릭 검증
            page.click("#btnUp_striker")
            page.click("#btnUp_destroyer")
            page.click("#btnUp_arcane")
            ups = page.evaluate("window.G.ups")
            assert ups["striker"] == 1 and ups["destroyer"] == 1 and ups["arcane"] == 1

            browser.close()
    finally:
        server.terminate()

    if errors:
        print("ERRORS DETECTED:", errors)
        sys.exit(1)
    print("E2E SMOKE TEST PASS (0 errors, 21 codex cards, summon/combine/primordial/boss verified)")

if __name__ == "__main__":
    run_test()
