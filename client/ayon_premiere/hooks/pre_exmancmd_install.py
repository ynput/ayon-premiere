import subprocess
import os

from ayon_premiere import PREMIERE_ADDON_ROOT
from ayon_applications import PreLaunchHook, LaunchTypes


class InstallAyonExtensionToPremiere(PreLaunchHook):
    app_groups = {"premiere"}

    order = 1
    launch_types = {LaunchTypes.local}

    def execute(self):
        try:
            settings = self.data["project_settings"][self.host_name]
            if not settings["hooks"]["InstallAyonExtensionToPremiere"]["enabled"]:
                return
            self.inner_execute(settings)
        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )

    def inner_execute(self, settings):
        self.log.info("Installing AYON Premiere extension.")

        exman_path = settings["hooks"]["InstallAyonExtensionToPremiere"]["exman_path"]
        if not exman_path:
            self.log.warning("ExManCmd path was not provided. Cancelling installation.")
            return

        exman_path = os.path.normpath(exman_path)
        if not os.path.exists(exman_path):
            self.log.warning(
                f"Provided ExManCmd path: '{exman_path}', does not exist. Cancelling installation."
            )
            return

        try:
            addon_path = os.path.join(
                PREMIERE_ADDON_ROOT,
                rf"api\extension.zxp",
            )

            command = [exman_path, "/install", addon_path]

            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                universal_newlines=True,
                env=dict(os.environ),
            )
            process.communicate()
            if process.returncode == 0:
                self.log.info("Successfully installed AYON extension")
            else:
                self.log.warning("Failed to install AYON extension")
        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )
