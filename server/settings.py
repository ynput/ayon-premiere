from ayon_server.settings import BaseSettingsModel, SettingsField

DEFAULT_VALUES = {}


class MySettings(BaseSettingsModel):
    pass


class InstallAyonExtensionSettingsModel(BaseSettingsModel):
    exman_path: str = SettingsField("", title="Path to ExManCmd executable")
    enabled: bool = SettingsField(False, title="Enabled")


class HooksModel(BaseSettingsModel):
    InstallAyonExtensionToPremiere: InstallAyonExtensionSettingsModel = (
        SettingsField(
            default_factory=InstallAyonExtensionSettingsModel,
            title="Install Extension",
            description="Installs the AYON extension using the supplied ExManCmd on startup.",
        )
    )
