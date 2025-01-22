from ayon_core.pipeline import LoaderPlugin
from .launch_logic import get_stub


class PremiereLoader(LoaderPlugin):
    @staticmethod
    def get_stub():
        return get_stub()
