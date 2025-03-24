import os
from typing import Any, Dict, List

from ayon_core.lib import EnumDef
from ayon_core.pipeline.load import LoadError
from ayon_premiere import api
from ayon_premiere.api.lib import get_unique_bin_name


class AECompLoader(api.PremiereLoader):
    """Load AfterEffects composition(s) into Premiere as Bins.

    Wraps loaded items into Bins for management and stores metadata in a
    dedicated "AYON Metadata" Bin using Clip.Description field.
    """
    label = "Load AfterEffects Compositions"
    icon = "image"
    product_types = {"workfile"}
    representations = {"aep"}

    def load(
        self,
        context: Dict[str, Any],
        name: str = None,
        namespace: str = None,
        options: Dict[str, Any] = None
    ) -> None:
        """Main loading method for After Effects compositions."""
        stub = self.get_stub()
        options = options or {}
        repr_entity = context["representation"]
        repre_id = repr_entity["id"]

        # Validate path
        path = self.filepath_from_context(context).replace("\\", "/")
        if not os.path.exists(path):
            raise LoadError(
                f"Invalid path for representation {repre_id}: {path}")

        # Get selected compositions
        selected_compositions = options.get(
            "compositions") or self._get_default_compositions(context)
        if not selected_compositions:
            raise LoadError("No compositions selected for loading")

        # Process each selected composition
        folder_name = context["folder"]["name"]
        for composition in selected_compositions:
            self._load_single_composition(
                context=context,
                composition=composition,
                stub=stub,
                path=path,
            )

    def update(self, container: Dict[str, Any],
               context: Dict[str, Any]) -> None:
        """Update container with new version or asset."""
        stub = self.get_stub()
        stored_bin = container.pop("bin")
        old_metadata = stub.get_item_metadata(stored_bin)

        # Get context data
        folder_name = context["folder"]["name"]
        product_name = context["product"]["name"]
        repr_entity = context["representation"]
        repr_data = repr_entity["data"]

        # Handle composition to update
        composition = self._get_composition_to_update(container, repr_data)
        new_bin_name = self._get_updated_bin_name(
            container, context, product_name, stub, composition
        )

        # Validate composition exists in new version
        if composition not in repr_data.get("composition_names_in_workfile",
                                            []):
            raise LoadError(
                f"Composition '{composition}' not found in workfile")

        # Perform update
        path = self.filepath_from_context(context).replace("\\", "/")
        new_bin = stub.replace_ae_comp(
            stored_bin.id,
            path,
            new_bin_name,
            [composition]
        )

        # Update metadata
        updated_metadata = {
            **old_metadata,
            "members": [new_bin.id],
            "representation": repr_entity["id"],
            "name": new_bin_name,
            "namespace": f"{folder_name}_{product_name}"
        }
        stub.imprint(new_bin.id, updated_metadata)

    def remove(self, container: Dict[str, Any]) -> None:
        """Remove container from Premiere project."""
        stub = self.get_stub()
        stored_bin = container.pop("bin")
        stub.imprint(stored_bin.id, {})
        stub.delete_item(stored_bin.id)

    def switch(self, container: Dict[str, Any],
               context: Dict[str, Any]) -> None:
        """Allows switching folder or product"""
        self.update(container, context)

    @classmethod
    def get_options(cls, contexts: List[Dict[str, Any]]) -> List[EnumDef]:
        """Get composition selection options."""
        repr_entity = contexts[0]["representation"]
        compositions = repr_entity["data"].get("composition_names_in_workfile",
                                               [])

        return [
            EnumDef(
                "compositions",
                label="Available compositions",
                items={comp: comp for comp in compositions},
                default=[compositions[0]] if compositions else [],
                multiselection=True
            )
        ]

    def _load_single_composition(
        self,
        context: Dict[str, Any],
        composition: str,
        stub: Any,
        path: str,
    ) -> None:
        """Handle loading of a single composition."""
        # Generate unique bin name
        new_bin_name = self._generate_bin_name(context, stub, composition)

        # Import composition
        import_element = stub.import_ae_comp(path, new_bin_name, [composition])
        repre_id = context["representation"]["id"]
        if not import_element:
            raise LoadError(
                f"Failed to load composition '{composition}' "
                f"(representation {repre_id}). "
                "Check host app for error details."
            )

        # Create container
        product_name = context["product"]["name"]
        folder_name = context["folder"]["name"]
        namespace = f"{folder_name}_{product_name}"
        api.containerise(
            new_bin_name,
            namespace,
            import_element,
            context,
            self.__class__.__name__,
            composition
        )

    def _generate_bin_name(
        self,
        context: Dict[str, Any],
        stub: Any,
        composition: str
    ) -> str:
        """Generate unique bin name for composition."""
        existing_bins = stub.get_items(bins=True, sequences=False,
                                       footages=False)
        existing_names = [bin_info.name for bin_info in existing_bins]
        folder_name = context["folder"]["name"]
        product_name = context["product"]["name"]
        return get_unique_bin_name(
            existing_names,
            f"{stub.LOADED_ICON}{folder_name}_{product_name}_{composition}"
        )

    def _get_updated_bin_name(
        self,
        container: Dict[str, Any],
        context: Dict[str, Any],
        product_name: str,
        stub: Any,
        composition: str
    ) -> str:
        """Determine appropriate bin name for updated container.

        Returns existing name if namespace matches, generates new unique name if not.
        """
        folder_name = context["folder"]["name"]
        new_namespace = f"{folder_name}_{product_name}"

        if container["namespace"] != new_namespace:
            # Asset switch - need new unique name
            return self._generate_bin_name(context, stub, composition)

        # Version update - keep existing name
        return container["name"]

    def _get_default_compositions(self, context: Dict[str, Any]) -> List[str]:
        """Get default compositions from representation data."""
        return context["representation"]["data"].get(
            "composition_names_in_workfile", [])

    def _get_composition_to_update(
        self,
        container: Dict[str, Any],
        repr_data: Dict[str, Any]
    ) -> str:
        """Get composition name for update operation."""
        if composition := container.get("imported_composition"):
            return composition

        # Backward compatibility for older containers
        if comp_names := repr_data.get("composition_names_in_workfile"):
            return comp_names[0]

        raise LoadError("No composition found for update")
