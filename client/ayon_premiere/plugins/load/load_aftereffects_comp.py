import os

from ayon_core.lib import EnumDef
from ayon_core.pipeline.load import LoadError, LoaderSwitchNotImplementedError

from ayon_premiere import api
from ayon_premiere.api.lib import get_unique_bin_name


class AECompLoader(api.PremiereLoader):
    """Load AfterEffects composition(s).

    Wraps loaded item into Bin (to be able to delete it if necessary)
    Stores the imported asset in a container named after the asset.

    Metadata stored in dummy `AYON Metadata` Bin in Clip.Description field.
    """
    label = "Load AfterEffects Compositions"
    icon = "image"

    product_types = {
        "workfile"
    }
    representations = {"aep"}

    def load(self, context, name=None, namespace=None, options=None):
        stub = self.get_stub()
        repr_id = context["representation"]["id"]

        path = self.filepath_from_context(context).replace("\\", "/")
        if not path or not os.path.exists(path):
            raise LoadError(
                f"Representation id `{repr_id}` has invalid path `{path}`")

        selected_compositions = options.get("compositions") or []
        if not selected_compositions:
            repre_data = context["representation"]["data"]
            selected_compositions = (
                repre_data.get("composition_names_in_workfile", {}))

        for comp in selected_compositions:
            new_bin_name = self._get_bin_name(context, f"{name}_{comp}", stub)

            import_element = stub.import_ae_comp(
                path,
                new_bin_name,
                [comp]
            )

            if not import_element:
                msg = (f"Representation id `{repr_id}` failed to load."
                        "Check host app for alert error.")
                raise LoadError(msg)

            self[:] = [import_element]
            folder_name = context["folder"]["name"]
            # imported product with folder, eg. "chair_renderMain"
            namespace = f"{folder_name}_{name}"
            api.containerise(
                new_bin_name,  # "{stub.LOADED_ICON}chair_renderMain_001"
                namespace,     # chair_renderMain
                import_element,
                context,
                self.__class__.__name__,
                comp
            )

    def update(self, container, context):
        """ Switch asset or change version """
        stub = self.get_stub()
        stored_bin = container.pop("bin")
        old_metadata = stub.get_item_metadata(stored_bin)

        folder_name = context["folder"]["name"]
        product_name = context["product"]["name"]
        repre_entity = context["representation"]

        repre_data = context["representation"]["data"]
        comp_names_workfile = repre_data.get("composition_names_in_workfile")

        comp_to_update = container.get("imported_composition")
        # TODO remove - backward compatibility
        # imported_composition could be missing on old containers
        if not comp_to_update:
            if comp_names_workfile:
                comp_to_update = comp_names_workfile[0]

        new_container_name = f"{folder_name}_{product_name}"
        # switching assets
        if container["namespace"] != new_container_name:
            new_bin_name = self._get_bin_name(context, product_name, stub)
        else:  # switching version - keep same name
            new_bin_name = container["name"]
            if comp_to_update not in comp_names_workfile:
                raise LoadError(f"'{comp_to_update}' is not in workfile")

        path = self.filepath_from_context(context).replace("\\", "/")
        new_bin = stub.replace_ae_comp(
            stored_bin.id,
            path,
            new_bin_name,
            [comp_to_update]
        )

        # update old metadata with new values
        old_metadata["members"] = [new_bin.id]
        old_metadata["representation"] = repre_entity["id"]
        old_metadata["name"] = new_bin_name
        old_metadata["namespace"] = new_container_name
        stub.imprint(
            new_bin.id,
            old_metadata
        )

    def remove(self, container):
        """
            Removes element from scene: deletes layer + removes from Headline
        Args:
            container (dict): container to be removed - used to get layer_id
        """
        stub = self.get_stub()
        stored_bin = container.pop("bin")
        stub.imprint(stored_bin.id, {})
        stub.delete_item(stored_bin.id)

    def switch(self, container, context):
        self.update(container, context)

    @classmethod
    def get_options(cls, contexts):
        repre = contexts[0]["representation"]
        items = {
            comp:comp
            for comp in repre["data"].get("composition_names_in_workfile", [])
        }
        default_comp = ""
        if items:
            default_comp = [list(items.keys())[0]]
        return [
            EnumDef(
                "compositions",
                label="Available compositions",
                items=items,
                default=default_comp,
                multiselection=True
            )
        ]

    def _get_bin_name(self, context, product_name, stub):
        existing_bins = stub.get_items(
            bins=True, sequences=False, footages=False)
        existing_bin_names = [bin_info.name for bin_info in existing_bins]
        folder_name = context["folder"]["name"]
        new_bin_name = get_unique_bin_name(
            existing_bin_names,
            f"{stub.LOADED_ICON}{folder_name}_{product_name}"
        )
        return new_bin_name
