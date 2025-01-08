import subprocess
import os
from zipfile import ZipFile

from ayon_premiere import PREMIERE_ADDON_ROOT
from ayon_applications import PreLaunchHook, LaunchTypes


class InstallAyonExtensionToPremiere(PreLaunchHook):
    app_groups = {"premiere"}

    order = 1
    launch_types = {LaunchTypes.local}

    def execute(self):
        try:
            settings = self.data["project_settings"][self.host_name]
            if not settings["hooks"]["InstallAyonExtensionToPremiere"][
                "enabled"
            ]:
                return
            self.inner_execute(settings)
        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )

    def inner_execute(self, settings):
        self.log.info("Installing AYON Premiere extension.")

        addon_path = os.path.join(
            PREMIERE_ADDON_ROOT,
            r"api\extension.zxp",
        )
        target_path = os.path.join(
            os.environ["appdata"], r"Adobe\CEP\extensions\io.ynput.PPRO.panel"
        )

        if os.path.exists(target_path):
            self.log.info(f"Extension already exists at: {target_path}")
            return

        try:
            self.log.debug(f"Creating directory: {target_path}")
            os.makedirs(target_path, exist_ok=True)

            with ZipFile(addon_path, "r") as zip:
                zip.extractall(path=target_path)

            self.log.info("Successfully installed AYON extension")

        except Exception as error:
            self.log.warning(
                f"Failed to install AYON extension due to: {error}"
            )
