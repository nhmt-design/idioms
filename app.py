from pathlib import Path
import shutil

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"


def publish_static_site() -> None:
    """Expose the existing HTML app through Streamlit's static-file server."""
    STATIC.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "index.html", STATIC / "index.html")

    for folder_name in ("assets", "content"):
        source = ROOT / folder_name
        target = STATIC / folder_name
        shutil.copytree(source, target, dirs_exist_ok=True)


st.set_page_config(
    page_title="南华熊成语漫画电子书",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="collapsed",
)

publish_static_site()

st.markdown(
    """
    <style>
    #MainMenu, header, footer, [data-testid="stToolbar"] {display: none !important;}
    .stApp {background: #07152e;}
    .block-container {
        padding: 0 !important;
        max-width: 100% !important;
    }
    iframe {
        display: block;
        width: 100%;
        border: 0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

components.iframe(
    "/app/static/index.html",
    height=1100,
    scrolling=True,
)
