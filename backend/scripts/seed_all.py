import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from scripts import seed_audit, seed_auth, seed_procurement, seed_products  # noqa: E402


def main() -> None:
    seed_auth.main()
    seed_products.main()
    seed_procurement.main()
    seed_audit.main()


if __name__ == "__main__":
    main()

