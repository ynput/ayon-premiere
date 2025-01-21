import os
import re
import platform
import shutil
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
            if not settings["hooks"]["InstallAyonExtensionToPremiere"][
                "enabled"
            ]:
                return
            self.inner_execute()

        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )

    def inner_execute(self):
        self.log.info("Installing AYON Premiere extension.")

        # Windows only for now.
        if not platform.system().lower() == "windows":
            self.log.info("Non Windows platform. Cancelling..")
            return

        target_path = os.path.join(
            os.environ["appdata"], r"Adobe\CEP\extensions\io.ynput.PPRO.panel"
        )

        extension_path = os.path.join(
            PREMIERE_ADDON_ROOT,
            r"api\extension.zxp",
        )

        try:
            deploy = self._should_deploy_extension(extension_path, target_path)

            if not deploy:
                self.log.debug(f"Extension already deployed at {target_path}.")
                return

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

    def _should_deploy_extension(
            self, extension_path: str, target_path:str) -> bool:
        """Check if current extension version is installed, purge old one."""
        with ZipFile(extension_path, 'r') as zip_file:
            with zip_file.open('CSXS/manifest.xml') as manifest_file:
                content = manifest_file.read()
                pattern = r'ExtensionBundleVersion="([^"]+)"'
                extension_version = re.search(pattern, str(content)).group(1)

        deployed_manifest_path = os.path.join(
            target_path, "CSXS", "manifest.xml")
        if not os.path.exists(deployed_manifest_path):
            return True

        with open(deployed_manifest_path, "r") as deployed_manifest_file:
            deployed_content = deployed_manifest_file.read()
            deployed_extension_version =(
                re.search(pattern, str(deployed_content)).group(1)
            )

        if extension_version != deployed_extension_version:
            self.log.info(f"Purging {target_path} because different version")
            shutil.rmtree(target_path)
            return True

        return False
