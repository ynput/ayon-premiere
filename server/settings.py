from ayon_server.settings import BaseSettingsModel, SettingsField


class PremiereSettings(BaseSettingsModel):
    auto_install_extension: bool = SettingsField(
        True,
        title="Install AYON Extension",
        description="Triggers pre-launch hook which installs extension."
    )


DEFAULT_VALUES = {
    "auto_install_extension": True
}
