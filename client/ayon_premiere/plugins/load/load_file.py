import os
from ayon_core.pipeline import get_representation_path
from ayon_premiere import api
from ayon_premiere.api.lib import get_unique_bin_name


class FileLoader(api.PremiereLoader):
    """Load images

    Stores the imported asset in a container named after the asset.
    """
    label = "Load file"

    product_types = {
        "image",
        "plate",
        "render",
        "prerender",
        "review",
        "audio",
    }
    representations = {"*"}

    def load(self, context, name=None, namespace=None, data=None):
        stub = self.get_stub()
        repr_id = context["representation"]["id"]

        new_bin_name = self._get_bin_name(context, name, stub)

        path = self.filepath_from_context(context)
        if not path or not os.path.exists(path):
            self.log.warning(
                f"Representation id `{repr_id}` has invalid path `{path}`")
            return

        paths = [path]

        image_sequence = False
        if len(context["representation"]["files"]) > 1:
            image_sequence = True
            dir_path = os.path.dirname(path)
            paths = [os.path.join(dir_path, repre_file["name"])
                     for repre_file in context["representation"]["files"]]

        paths = [path.replace("\\", "/") for path in paths]

        import_element = stub.import_files(paths, new_bin_name, image_sequence)

        if not import_element:
            self.log.warning(
                f"Representation id `{repr_id}` failed to load.")
            self.log.warning("Check host app for alert error.")
            return

        self[:] = [import_element]
        folder_name = context["folder"]["name"]
        # imported product with folder, eg. "chair_renderMain"
        namespace = f"{folder_name}_{name}"
        return api.containerise(
            new_bin_name,  # "chair_renderMain_001"
            namespace,
            import_element,
            context,
            self.__class__.__name__
        )

    def update(self, container, context):
        """ Switch asset or change version """
        stub = self.get_stub()
        stored_bin = container.pop("bin")

        folder_name = context["folder"]["name"]
        product_name = context["product"]["name"]
        repre_entity = context["representation"]

        new_container_name = f"{folder_name}_{product_name}"
        # switching assets
        if container["namespace"] != new_container_name:
            new_bin_name = self._get_bin_name(context, product_name, stub)
        else:  # switching version - keep same name
            new_bin_name = container["name"]
        paths = [get_representation_path(repre_entity)]

        if len(repre_entity["files"]) > 1:
            dir_path = os.path.dirname(paths[0])
            paths = [os.path.join(dir_path, repre_file["name"])
                     for repre_file in context["representation"]["files"]]

        stub.replace_item(stored_bin.id, paths, new_bin_name)
        stub.imprint(
            stored_bin.id,
            {
                "representation": repre_entity["id"],
                "name": new_bin_name,
                "namespace": new_container_name
            }
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
