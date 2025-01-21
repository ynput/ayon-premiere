from ayon_server.settings import BaseSettingsModel, SettingsField


class HookOptionalModel(BaseSettingsModel):
    enabled: bool = SettingsField(False, title="Enabled")


class HooksModel(BaseSettingsModel):
    InstallAyonExtensionToPremiere: HookOptionalModel = SettingsField(
        default_factory=HookOptionalModel,
        title="Install AYON Extension",
    )


class PremiereSettings(BaseSettingsModel):
    hooks: HooksModel = SettingsField(
        default_factory=HooksModel, title="Hooks"
    )


DEFAULT_VALUES = {
    "hooks": {
        "InstallAyonExtensionToPremiere": {
            "enabled": False,
        }
    }
}
