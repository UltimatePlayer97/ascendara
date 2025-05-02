# ==============================================================================
# Ascendara Notification Helper
# ==============================================================================
# A command-line tool for handling Ascendara notifications
# Read more about the Notification Helper Tool here:
# https://ascendara.app/docs/binary-tool/notification-helper






import sys
import os
import argparse
import logging
from typing import Literal
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, 
    QVBoxLayout, QHBoxLayout, QGraphicsOpacityEffect, QGraphicsDropShadowEffect
)
from PyQt6.QtCore import Qt, QTimer, QEasingCurve, QPropertyAnimation, QRect, QSize, QPoint
from PyQt6.QtGui import QColor, QPainter, QPainterPath, QIcon, QPixmap
import subprocess
import atexit

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath("./src")
    return os.path.join(base_path, relative_path)

# Pre-compute theme colors as QColor objects
THEME_COLORS = {
    "light": {
        "bg": QColor(255, 255, 255),      # --color-background
        "fg": QColor(15, 23, 42),         # --color-foreground
        "border": QColor(226, 232, 240),  # --color-border
        "shadow": QColor(0, 0, 0, 50),    # subtle shadow
    },
    "dark": {
        "bg": QColor(15, 23, 42),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(51, 65, 85),      # --color-border
        "shadow": QColor(0, 0, 0, 160),   # deeper shadow
    },
    "blue": {
        "bg": QColor(30, 41, 59),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(59, 130, 246),    # --color-border
        "shadow": QColor(0, 0, 0, 120),
    },
    "purple": {
        "bg": QColor(88, 28, 135),        # --color-background
        "fg": QColor(237, 233, 254),      # --color-foreground
        "border": QColor(147, 51, 234),    # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "emerald": {
        "bg": QColor(6, 78, 59),          # --color-background
        "fg": QColor(209, 250, 229),      # --color-foreground
        "border": QColor(16, 185, 129),    # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "rose": {
        "bg": QColor(159, 18, 57),        # --color-background
        "fg": QColor(255, 228, 230),      # --color-foreground
        "border": QColor(244, 63, 94),     # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "cyberpunk": {
        "bg": QColor(17, 24, 39),         # --color-background
        "fg": QColor(236, 72, 153),       # --color-foreground
        "border": QColor(244, 114, 182),   # --color-border
        "shadow": QColor(0, 0, 0, 120),
    },
    "sunset": {
        "bg": QColor(124, 45, 18),        # --color-background
        "fg": QColor(254, 215, 170),      # --color-foreground
        "border": QColor(251, 146, 60),    # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "forest": {
        "bg": QColor(20, 83, 45),         # --color-background
        "fg": QColor(187, 247, 208),      # --color-foreground
        "border": QColor(34, 197, 94),     # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "midnight": {
        "bg": QColor(30, 41, 59),         # --color-background
        "fg": QColor(241, 245, 249),      # --color-foreground
        "border": QColor(51, 65, 85),      # --color-border
        "shadow": QColor(0, 0, 0, 120),
    },
    "amber": {
        "bg": QColor(120, 53, 15),        # --color-background
        "fg": QColor(254, 243, 199),      # --color-foreground
        "border": QColor(245, 158, 11),    # --color-border
        "shadow": QColor(0, 0, 0, 110),
    },
    "ocean": {
        "bg": QColor(12, 74, 110),        # --color-background
        "fg": QColor(186, 230, 253),      # --color-foreground
        "border": QColor(14, 165, 233),    # --color-border
        "shadow": QColor(0, 0, 0, 110),
    }
}

# Cache for icon pixmap
_icon_pixmap = None

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [crash_reporter_path, "notificationhelper", str(error_code), error_message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    """Register the crash reporter to launch on exit with the given error details"""
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

class NotificationWindow(QWidget):
    def __init__(self, theme: Literal["light", "dark", "blue", "purple", "emerald", "rose", "cyberpunk", "sunset", "forest", "midnight", "amber", "ocean"], title: str, message: str):
        super().__init__()
        logger.info(f"Initializing notification with theme: {theme}")
        self.theme = theme if theme in THEME_COLORS else "dark"
        self.title = title
        self.message = message
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool | Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        self.bg_color = THEME_COLORS[self.theme]["bg"]
        self.fg_color = THEME_COLORS[self.theme]["fg"]
        self.border_color = THEME_COLORS[self.theme]["border"]
        self.shadow_color = THEME_COLORS[self.theme]["shadow"]
        self._setup_ui()
        self._apply_shadow()
        self._set_position()
        self._animate_in()
        QTimer.singleShot(4000, self.close_notification)

    def _setup_ui(self):
        self.setMinimumWidth(320)
        self.setMaximumWidth(380)
        self.setMinimumHeight(80)
        self.setMaximumHeight(160)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 16, 18, 16)
        layout.setSpacing(10)

        # Title
        title_label = QLabel(self.title)
        title_label.setStyleSheet(f"color: {self.fg_color.name()}; font-size: 15px; font-weight: 600; font-family: 'Segoe UI'; margin-bottom: 2px;")
        layout.addWidget(title_label)

        # Message
        message_label = QLabel(self.message)
        message_label.setStyleSheet(f"color: {self.fg_color.name()}; font-size: 13px; font-family: 'Segoe UI'; margin-bottom: 8px;")
        message_label.setWordWrap(True)
        layout.addWidget(message_label)

        # Action buttons (Open and Dismiss)
        button_layout = QHBoxLayout()
        button_layout.setSpacing(10)
        button_layout.addStretch()

        open_button = QPushButton("Open")
        open_button.setCursor(Qt.CursorShape.PointingHandCursor)
        open_button.setStyleSheet(
            f"QPushButton {{ background: {self.fg_color.name()}; color: {self.bg_color.name()}; border: none; border-radius: 8px; "
            f"font-size: 13px; font-family: 'Segoe UI'; font-weight: 600; padding: 5px 18px; }} "
            f"QPushButton:hover {{ background: {self.border_color.name()}; color: {self.fg_color.name()}; }}"
        )
        open_button.clicked.connect(self._handle_open)
        button_layout.addWidget(open_button)

        dismiss_button = QPushButton("Dismiss")
        dismiss_button.setCursor(Qt.CursorShape.PointingHandCursor)
        dismiss_button.setStyleSheet(
            f"QPushButton {{ background: rgba(0,0,0,0.06); color: {self.fg_color.name()}; border: none; border-radius: 8px; "
            f"font-size: 13px; font-family: 'Segoe UI'; font-weight: 600; padding: 5px 18px; }} "
            f"QPushButton:hover {{ background: {self.fg_color.name()}; color: {self.bg_color.name()}; }}"
        )
        dismiss_button.clicked.connect(self.close_notification)
        button_layout.addWidget(dismiss_button)

        layout.addLayout(button_layout)

        # Footer (optional: can be removed if you want no branding at all)
        footer = QWidget()
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(0, 0, 0, 0)
        footer_layout.addStretch()
        # Uncomment next two lines if you want a subtle 'Ascendara' label in the corner
        # ascendara_label = QLabel("Ascendara")
        # ascendara_label.setStyleSheet(f"color: {self.border_color.name()}; font-family: 'Segoe UI'; font-size: 11px; font-style: italic; opacity: 0.7;")
        # footer_layout.addWidget(ascendara_label)
        layout.addWidget(footer)

    def _handle_open(self):
        import subprocess
        exe_path = get_resource_path("../Ascendara.exe")
        try:
            subprocess.Popen([exe_path], shell=False)
            logger.info(f"Launched: {exe_path}")
        except Exception as e:
            logger.error(f"Failed to launch {exe_path}: {e}")
        self.close_notification()

    def _apply_shadow(self):
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(22)
        shadow.setXOffset(0)
        shadow.setYOffset(6)
        shadow.setColor(self.shadow_color)
        self.setGraphicsEffect(shadow)

    def _set_position(self):
        screen = QApplication.primaryScreen()
        geometry = screen.geometry()
        dpr = screen.devicePixelRatio() if hasattr(screen, 'devicePixelRatio') else 1.0
        width, height = int(380 * dpr), int(110 * dpr)
        margin_x, margin_y = int(32 * dpr), int(32 * dpr)
        self.setGeometry(
            geometry.width() - width - margin_x,
            geometry.height() - height - margin_y,
            width,
            height
        )
        logger.debug(f"Window positioned at: {geometry.width() - width - margin_x}, {geometry.height() - height - margin_y}")

    def _animate_in(self):
        # Animate in (fade and slide)
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.opacity_effect.setOpacity(0.0)
        self.fade_in_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_in_animation.setDuration(260)
        self.fade_in_animation.setStartValue(0.0)
        self.fade_in_animation.setEndValue(1.0)
        self.fade_in_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.fade_in_animation.start()
        self.move(self.x(), self.y() + 40)
        self.slide_in_animation = QPropertyAnimation(self, b"pos")
        self.slide_in_animation.setDuration(260)
        self.slide_in_animation.setStartValue(self.pos())
        self.slide_in_animation.setEndValue(self.pos() - QPoint(0, 40))
        self.slide_in_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.slide_in_animation.start()

        # Schedule fade out
        QTimer.singleShot(4000, self.close_notification)

        # Show window
        self.show()
        logger.debug("Window shown")

    def _set_icon(self, label):
        global _icon_pixmap
        if _icon_pixmap is None:
            icon_path = get_resource_path("ascendara.ico")
            if os.path.exists(icon_path):
                pixmap = QPixmap(icon_path)
                if not pixmap.isNull():
                    _icon_pixmap = pixmap.scaled(
                        24, 24,
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    logger.debug("Icon loaded and cached")
                else:
                    logger.error("Failed to load icon pixmap")
                    self._set_fallback_icon(label)
                    return
            else:
                logger.warning(f"Icon not found at: {icon_path}, using fallback")
                self._set_fallback_icon(label)
                return

        label.setPixmap(_icon_pixmap)
        self.setWindowIcon(QIcon(_icon_pixmap))

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Modern, softer rounded rectangle
        radius = 18
        path = QPainterPath()
        path.addRoundedRect(0, 0, self.width(), self.height(), radius, radius)

        # Draw background
        painter.setPen(Qt.PenStyle.NoPen)
        painter.fillPath(path, self.bg_color)

        # Draw subtle border with opacity
        border_color = QColor(self.border_color)
        border_color.setAlpha(110)
        painter.setPen(border_color)
        painter.drawPath(path)

    def close_notification(self):
        if hasattr(self, 'fade_out_animation'):
            return

        logger.info("Starting fade-out and slide-down animation")
        self.fade_out_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_out_animation.setDuration(180)
        self.fade_out_animation.setStartValue(1.0)
        self.fade_out_animation.setEndValue(0.0)
        self.fade_out_animation.setEasingCurve(QEasingCurve.Type.InCubic)
        self.fade_out_animation.finished.connect(self.cleanup)
        self.fade_out_animation.start()

        self.slide_out_animation = QPropertyAnimation(self, b"pos")
        self.slide_out_animation.setDuration(180)
        self.slide_out_animation.setStartValue(self.pos())
        self.slide_out_animation.setEndValue(self.pos() + QPoint(0, 40))
        self.slide_out_animation.setEasingCurve(QEasingCurve.Type.InCubic)
        self.slide_out_animation.start()

    def cleanup(self):
        logger.info("Cleanup: closing window and quitting application")
        self.close()
        QApplication.instance().quit()

    def _set_fallback_icon(self, label):
        """Set fallback 'A' icon when the icon file cannot be loaded"""
        label.setText("A")
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        label.setStyleSheet(f"""
            QLabel {{
                background-color: {self.border_color.name()};
                color: {self.fg_color.name()};
                border-radius: 12px;
                font-family: 'Segoe UI';
                font-size: 15px;
                font-weight: 600;
                min-width: 24px;
                min-height: 24px;
                max-width: 24px;
                max-height: 24px;
                text-align: center;
                opacity: 0.85;
            }}
        """)

import traceback

def main():
    parser = argparse.ArgumentParser(description='Show a notification with the specified theme')
    parser.add_argument('--theme', type=str, default='dark', help='Theme to use for the notification')
    parser.add_argument('--title', type=str, default='Notification', help='Title of the notification')
    parser.add_argument('--message', type=str, default='This is a notification', help='Message to display')
    args = parser.parse_args()
    
    logger.info(f"Starting notification helper with args: {args}")
    
    try:
        app = QApplication(sys.argv)
        window = NotificationWindow(args.theme, args.title, args.message)
        sys.exit(app.exec())
    except Exception as e:
        logger.error("Exception occurred:")
        traceback.print_exc()
        launch_crash_reporter(1, str(e))

if __name__ == "__main__":
    main()