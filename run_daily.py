"""하위 호환용 진입점 — run.py 를 사용하세요."""
import runpy
import sys

if __name__ == "__main__":
    sys.argv = [sys.argv[0]] + sys.argv[1:]
    runpy.run_path(__file__.replace("run_daily.py", "run.py"), run_name="__main__")
