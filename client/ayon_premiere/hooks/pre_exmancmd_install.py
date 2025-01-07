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
            self.inner_execute()
        except Exception:
            self.log.warning(
                "Processing of {} crashed.".format(self.__class__.__name__),
                exc_info=True,
            )

    def inner_execute(self):
        self.log.debug("Installing AYON extension.")

        self.log.debug(
            self.data["project_settings"][self.host_name]["hooks"][
                "InstallAyonExtensionToPremiere"
            ]["exman_path"]
        )
