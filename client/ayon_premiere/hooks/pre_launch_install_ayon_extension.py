import os
from zipfile import ZipFile

from ayon_premiere import PREMIERE_ADDON_ROOT
from ayon_applications import PreLaunchHook, LaunchTypes


class InstallAyonExtensionToPremiere(PreLaunchHook):
    """
    Automatically 'installs' the AYON Premiere extension.

    Checks if Premiere already has the extension in the relevant folder,
    will try to create that folder and unzip the extension if not.
    """

    app_groups = {"premiere"}

    order = 1
    launch_types = {LaunchTypes.local}

    def execute(self):
        try:
            settings = self.data["project_settings"][self.host_name]
            if not settings["hooks"]["InstallAyonExtensionToPremiere"]["enabled"]:
                return
            self.inner_execute()

        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )

    def inner_execute(self):
        self.log.info("Installing AYON Premiere extension.")

        target_path = os.path.join(
            os.environ["appdata"], r"Adobe\CEP\extensions\io.ynput.PPRO.panel"
        )

        if os.path.exists(target_path):
            self.log.info(
                f"The extension already exists at: {target_path}. Cancelling.."
            )
            return

        extension_path = os.path.join(
            PREMIERE_ADDON_ROOT,
            r"api\extension.zxp",
        )

        try:
            self.log.debug(f"Creating directory: {target_path}")
            os.makedirs(target_path, exist_ok=True)

            with ZipFile(extension_path, "r") as zip:
                zip.extractall(path=target_path)

            self.log.info("Successfully installed AYON extension")

        except OSError as error:
            self.log.warning(f"OS error has occured: {error}")

        except PermissionError as error:
            self.log.warning(f"Permissions error has occured: {error}")

        except Exception as error:
            self.log.warning(f"An unexpected error occured: {error}")
