from dataclasses import dataclass


@dataclass(frozen=True)
class ColorPalette:
    header: str = "\033[95m"
    ok_blue: str = "\033[94m"
    ok_cyan: str = "\033[96m"
    ok_green: str = "\033[92m"
    warning: str = "\033[93m"
    fail: str = "\033[91m"
    endc: str = "\033[0m"
    bold: str = "\033[1m"
    underline: str = "\033[4m"


DEFAULT_PALETTE = ColorPalette()
