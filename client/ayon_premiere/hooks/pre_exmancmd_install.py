import subprocess
import os

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
        self.log.info("Installing AYON extension.")

        exman_path = settings["hooks"]["InstallAyonExtensionToPremiere"]["exman_path"]
        if not exman_path:
            # no exman path provided
            # TODO: add a error message here
            return

        exman_path = os.path.normpath(exman_path)
        if not os.path.exists(exman_path):
            # path invalid
            # TODO: add error
            return

        local_app_data = os.environ["LOCALAPPDATA"]

        # TODO: dynamic path to relavant addon version
        addon_path = os.path.join(
            local_app_data,
            r"Ynput\AYON\addons\premiere_0.1.0-dev.2\ayon_premiere\api\extension.zxp",
        )

        command = [exman_path, "/install", addon_path]

        try:
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
