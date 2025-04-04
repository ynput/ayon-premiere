"""
    Stub handling connection from server to client.
    Used anywhere solution is calling client methods.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import List

from wsrpc_aiohttp import WebSocketAsync

from .webserver import WebServerTool


class ConnectionNotEstablishedYet(Exception):
    pass

# TODO still contains unneeded/uniplemented code inherited from AE impl

@dataclass
class PPROItem(object):
    """
        Object denoting Item in PPRO. Each item is created in PPRO by any
        Loader, but contains same fields, which are being used in
        later processing.
    """
    # metadata
    id: str = field()
    name: str = field()
    members: List[str] = field(default_factory=list)


class PremiereServerStub():
    """
        Stub for calling function on client (Photoshop js) side.
        Expects that client is already connected (started when avalon menu
        is opened).
        'self.websocketserver.call' is used as async wrapper
    """
    PUBLISH_ICON = "\u2117 "
    LOADED_ICON = "\u25bc"

    def __init__(self):
        self.websocketserver = WebServerTool.get_instance()
        self.client = self.get_client()
        self.log = logging.getLogger(self.__class__.__name__)

    @staticmethod
    def get_client():
        """
            Return first connected client to WebSocket
            TODO implement selection by Route
        :return: <WebSocketAsync> client
        """
        clients = WebSocketAsync.get_clients()
        client = None
        if len(clients) > 0:
            key = list(clients.keys())[0]
            client = clients.get(key)

        return client

    def open(self, path):
        """
            Open file located at 'path' (local).
        Args:
            path(string): file path locally
        Returns: None
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.open", path=path))

        return self._handle_return(res)

    def get_metadata(self):
        """
            Get complete stored JSON with metadata from dummy AYON sequence
            field.

            It contains containers loaded by any Loader OR instances created
            by Creator.

        Returns:
            (list)
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.get_metadata"))
        metadata = self._handle_return(res)

        return metadata or []

    def get_item_metadata(self, item, project_metadata=None):
        """
            Parses item metadata from dummy `AYON Metadata` Bin of active
            document.
            Used as filter to pick metadata for specific 'item' only as
            metadata are stored as a list in all DCCs.

        Args:
            item (PPROItem): pulled info from PPRO
            project_metadata (dict): full stored metadata for AYON container or
                instances
                (load and inject for better performance in loops)
        Returns:
            (dict):
        """
        if project_metadata is None:
            project_metadata = self.get_metadata()
        for item_meta in project_metadata:
            if "container" in item_meta.get("id") and \
                    item.id == item_meta.get("members")[0]:
                return item_meta

        self.log.debug("Couldn't find item metadata")

    def imprint(self, item_id, data, all_items=None, items_meta=None):
        """
            Save item metadata to Label field of metadata of active document
        Args:
            item_id (int|str): id of FootageItem or instance_id for workfiles
            data(string): json representation for single layer
            all_items (list of item): for performance, could be
                injected for usage in loop, if not, single call will be
                triggered
            items_meta(string): json representation from Headline
                           (for performance - provide only if imprint is in
                           loop - value should be same)
        Returns: None
        """
        if not items_meta:
            items_meta = self.get_metadata()

        result_meta = []
        # fix existing
        is_new = True

        for item_meta in items_meta:
            if ((item_meta.get("members") and
                    str(item_id) == str(item_meta.get("members")[0])) or
                    item_meta.get("instance_id") == item_id):
                is_new = False
                if data:
                    item_meta.update(data)
                    result_meta.append(item_meta)
            else:
                result_meta.append(item_meta)

        if is_new:
            result_meta.append(data)

        # Ensure only valid ids are stored.
        if not all_items:
            # loaders create FootageItem now
            all_items = self.get_items(
                bins=True, sequences=True, footages=True)
        item_ids = [item.id for item in all_items]
        cleaned_data = []
        for meta in result_meta:
            # do not added instance with nonexistend item id
            if meta.get("members"):
                if meta["members"][0] not in item_ids:
                    continue

            cleaned_data.append(meta)

        payload = json.dumps(cleaned_data, indent=4)

        res = self.websocketserver.call(
            self.client.call("Premiere.imprint", payload=payload)
        )
        return self._handle_return(res)

    def get_active_document_full_name(self):
        """
            Returns absolute path of active document via ws call
        Returns(string): file name
        """
        res = self.websocketserver.call(self.client.call(
            "Premiere.get_active_document_full_name"))

        return self._handle_return(res)

    def get_active_document_name(self):
        """
            Returns just a name of active document via ws call
        Returns(string): file name
        """
        res = self.websocketserver.call(self.client.call(
            "Premiere.get_active_document_name"))

        return self._handle_return(res)

    def get_items(self, bins, sequences=False, footages=False):
        """
            Get all items from Project panel according to arguments.
            There are multiple different types:
                Bin - wrappers for multiple footage (image/movies)
                Sequences - publishable set of tracks made from footages
                Footage - imported files
        Args:
            bins (bool): return Bin
            sequences (bool): return Sequences
            footages (bool: return Footage

        Returns:
            (list) of namedtuples
        """
        res = self.websocketserver.call(
            self.client.call("Premiere.get_items",
                             bins=bins,
                             sequences=sequences,
                             footages=footages)
              )
        return self._to_records(self._handle_return(res))

    def select_items(self, items):
        """
            Select items in Project list
        Args:
            items (list): of int item ids
        """
        self.websocketserver.call(
            self.client.call("Premiere.select_items", items=items))


    def get_selected_items(self, sequences, bins=False, footages=False):
        """
            Same as get_items but using selected items only
        Args:
            sequences (bool): return CompItems
            bins (bool): return Bin
            footages (bool: return FootageItem

        Returns:
            (list) of namedtuples

        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.get_selected_items",
                                         comps=sequences,
                                         folders=bins,
                                         footages=footages)
                                        )
        return self._to_records(self._handle_return(res))

    def add_item(self, name, item_type):
        """
            Adds either composition or folder to project item list.

            Args:
                name (str)
                item_type (str): COMP|FOLDER
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.add_item",
                                         name=name,
                                         item_type=item_type))

        return self._handle_return(res)

    def get_item(self, item_id):
        """
            Returns metadata for particular 'item_id' or None

            Args:
                item_id (int, or string)
        """
        for item in self.get_items(bins=True, sequences=False, footages=False):
            if str(item.id) == str(item_id):
                return item

        return None

    def import_files(self, paths, item_name, is_image_sequence=False):
        """
            Imports file(s) into Bin. Used in Loader
        Args:
            paths (list[str]): absolute path for asset files
            item_name (string): label for created Bin
            is_image_sequence (bool): if loaded item is image sequence

        """
        res = self.websocketserver.call(
            self.client.call(
                "Premiere.import_files",
                paths=paths,
                item_name=item_name,
                is_image_sequence=is_image_sequence
            )
        )
        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def import_ae_comp(self, path, item_name, comp_names=None):
        """
            Imports file(s) into Bin. Used in Loader
        Args:
            path (str): absolute path for AE workfile
            item_name (string): label for created Bin
            comp_names (list[str]): selected comp

        """
        res = self.websocketserver.call(
            self.client.call(
                "Premiere.import_ae_comp",
                path=path,
                item_name=item_name,
                comp_names=comp_names
            )
        )
        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def replace_ae_comp(self, item_id, path, item_name, comp_names):
        """
            Imports file(s) into Bin. Used in Loader
        Args:
            item_id (str): Bin id
            path (str): absolute path for AE workfile
            item_name (string): label for created Bin
            comp_names (list[str]): selected comp

        """
        res = self.websocketserver.call(
            self.client.call(
                "Premiere.replace_ae_comp",
                item_id=item_id,
                path=path,
                item_name=item_name,
                comp_names=comp_names
            )
        )
        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def replace_item(self, item_id, paths, item_name, is_image_sequence):
        """ Replace FootageItem with new file

            Args:
                item_id (int):
                paths (string[str]):absolute path
                item_name (string): label on item in Project list
                is_image_sequence (bool): if should be loaded as image seq

        """
        res = self.websocketserver.call(self.client.call(
            "Premiere.replace_item",
            item_id=item_id,
            paths=paths,
            item_name=item_name,
            is_image_sequence=is_image_sequence
        ))

        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def rename_item(self, item_id, item_name):
        """ Replace item with item_name

            Args:
                item_id (int):
                item_name (string): label on item in Project list

        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.rename_item",
                                         item_id=item_id,
                                         item_name=item_name))

        return self._handle_return(res)

    def delete_item(self, item_id):
        """ Deletes *Item in a file
            Args:
                item_id (int):

        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.delete_item",
                                         item_id=item_id))

        return self._handle_return(res)

    def remove_instance(self, instance_id, metadata=None):
        """
            Removes instance with 'instance_id' from file's metadata and
            saves them.

            Keep matching item in file though.

            Args:
                instance_id(string): instance id
        """
        cleaned_data = []

        if metadata is None:
            metadata = self.get_metadata()

        for instance in metadata:
            inst_id = instance.get("instance_id") or instance.get("uuid")
            if inst_id != instance_id:
                cleaned_data.append(instance)

        payload = json.dumps(cleaned_data, indent=4)
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.imprint",
                                         payload=payload))

        return self._handle_return(res)

    def is_saved(self):
        # TODO
        return True

    def set_label_color(self, item_id, color_idx):
        """
            Used for highlight additional information in Project panel.
            Green color is loaded asset, blue is created asset
        Args:
            item_id (int):
            color_idx (int): 0-16 Label colors from PPRO Project view
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.set_label_color",
                                         item_id=item_id,
                                         color_idx=color_idx))

        return self._handle_return(res)

    def get_comp_properties(self, comp_id):
        """ Get composition information for render purposes

            Returns startFrame, frameDuration, fps, width, height.

            Args:
                comp_id (int):

            Returns:
                (PPROItem)

        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.get_comp_properties",
                                         item_id=comp_id
                                         ))

        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def set_comp_properties(self, comp_id, start, duration, frame_rate,
                            width, height):
        """
            Set work area to predefined values (from Ftrack).
            Work area directs what gets rendered.
            Beware of rounding, PPRO expects seconds, not frames directly.

        Args:
            comp_id (int):
            start (int): workAreaStart in frames
            duration (int): in frames
            frame_rate (float): frames in seconds
            width (int): resolution width
            height (int): resolution height
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.set_comp_properties",
                                         item_id=comp_id,
                                         start=start,
                                         duration=duration,
                                         frame_rate=frame_rate,
                                         width=width,
                                         height=height))
        return self._handle_return(res)

    def save(self):
        """
            Saves active document
        Returns: None
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.save"))

        return self._handle_return(res)

    def saveAs(self, project_path, as_copy):
        """
            Saves active project to aep (copy) or png or jpg
        Args:
            project_path(string): full local path
            as_copy: <boolean>
        Returns: None
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.saveAs",
                                         image_path=project_path,
                                         as_copy=as_copy))

        return self._handle_return(res)

    def get_render_info(self, comp_id):
        """ Get render queue info for render purposes

            Returns:
               (list) of (PPROItem): with 'file_name' field
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.get_render_info",
                                         comp_id=comp_id))

        records = self._to_records(self._handle_return(res))
        return records

    def get_audio_url(self, item_id):
        """ Get audio layer absolute url for comp

            Args:
                item_id (int): composition id
            Returns:
                (str): absolute path url
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.get_audio_url",
                                         item_id=item_id))

        return self._handle_return(res)

    def import_background(self, comp_id, comp_name, files):
        """
            Imports backgrounds images to existing or new composition.

            If comp_id is not provided, new composition is created, basic
            values (width, heights, frameRatio) takes from first imported
            image.

            All images from background json are imported as a FootageItem and
            separate layer is created for each of them under composition.

            Order of imported 'files' is important.

            Args:
                comp_id (int): id of existing composition (null if new)
                comp_name (str): used when new composition
                files (list): list of absolute paths to import and
                add as layers

            Returns:
                (PPROItem): object with id of created folder, all imported images
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.import_background",
                                         comp_id=comp_id,
                                         comp_name=comp_name,
                                         files=files))

        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def reload_background(self, comp_id, comp_name, files):
        """
            Reloads backgrounds images to existing composition.

            It actually deletes complete folder with imported images and
            created composition for safety.

            Args:
                comp_id (int): id of existing composition to be overwritten
                comp_name (str): new name of composition (could be same as old
                    if version up only)
                files (list): list of absolute paths to import and
                    add as layers
            Returns:
                (PPROItem): object with id of created folder, all imported images
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.reload_background",
                                         comp_id=comp_id,
                                         comp_name=comp_name,
                                         files=files))

        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def add_item_as_layer(self, comp_id, item_id):
        """
            Adds already imported FootageItem ('item_id') as a new
            layer to composition ('comp_id').

            Args:
                comp_id (int): id of target composition
                item_id (int): FootageItem.id
                comp already found previously
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.add_item_as_layer",
                                         comp_id=comp_id,
                                         item_id=item_id))

        records = self._to_records(self._handle_return(res))
        if records:
            return records.pop()

    def add_item_instead_placeholder(self, placeholder_item_id, item_id):
        """
            Adds item_id to layers where plaeholder_item_id is present.

            1 placeholder could result in multiple loaded containers (eg items)

            Args:
                placeholder_item_id (int): id of placeholder item
                item_id (int): loaded FootageItem id
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.add_item_instead_placeholder",  # noqa
                                         placeholder_item_id=placeholder_item_id,  # noqa
                                         item_id=item_id))

        return self._handle_return(res)

    def add_placeholder(self, name, width, height, fps, duration):
        """
            Adds new FootageItem as a placeholder for workfile builder

            Placeholder requires width etc, currently probably only hardcoded
            values.

            Args:
                name (str)
                width (int)
                height (int)
                fps (float)
                duration (int)
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.add_placeholder",
                                         name=name,
                                         width=width,
                                         height=height,
                                         fps=fps,
                                         duration=duration))

        return self._handle_return(res)

    def render(self, folder_url, comp_id):
        """
            Render all renderqueueitem to 'folder_url'
        Args:
            folder_url(string): local folder path for collecting
        Returns: None
        """
        res = self.websocketserver.call(self.client.call
                                        ("Premiere.render",
                                         folder_url=folder_url,
                                         comp_id=comp_id))
        return self._handle_return(res)

    def get_extension_version(self):
        """Returns version number of installed extension."""
        res = self.websocketserver.call(self.client.call(
            "Premiere.get_extension_version"))

        return self._handle_return(res)

    def get_app_version(self):
        """Returns version number of installed application (17.5...)."""
        res = self.websocketserver.call(self.client.call(
            "Premiere.get_app_version"))

        return self._handle_return(res)

    def close(self):
        res = self.websocketserver.call(self.client.call("Premiere.close"))

        return self._handle_return(res)

    def print_msg(self, msg):
        """Triggers Javascript alert dialog."""
        self.websocketserver.call(self.client.call
                                  ("Premiere.print_msg",
                                   msg=msg))

    def _handle_return(self, res):
        """Wraps return, throws ValueError if 'error' key is present."""
        if res and isinstance(res, str) and res != "undefined":
            try:
                parsed = json.loads(res)
            except json.decoder.JSONDecodeError:
                raise ValueError("Received broken JSON '{}'".format(res))

            if not parsed:  # empty list
                return parsed

            first_item = parsed
            if isinstance(parsed, list):
                first_item = parsed[0]

            if first_item:
                if first_item.get("error"):
                    raise ValueError(first_item["error"])
                # singular values (file name etc)
                if first_item.get("result") is not None:
                    return first_item["result"]
            return parsed  # parsed
        return res

    def _to_records(self, payload):
        """
            Converts string json representation into list of PPROItem
            dot notation access to work.
        Returns: <list of PPROItem>
            payload(dict): - dictionary from json representation, expected to
                come from _handle_return
        """
        if not payload:
            return []

        if isinstance(payload, str):  # safety fallback
            try:
                payload = json.loads(payload)
            except json.decoder.JSONDecodeError:
                raise ValueError("Received broken JSON {}".format(payload))

        if isinstance(payload, dict):
            payload = [payload]

        ret = []
        # convert to PPROItem to use dot donation
        for d in payload:
            if not d:
                continue
            # currently implemented and expected fields
            item = PPROItem(
                d.get("id"),
                d.get("name"),
                # d.get("type"),
                d.get("members"),
                # d.get("frameStart"),
                # d.get("framesDuration"),
                # d.get("frameRate"),
                # d.get("file_name"),
                # d.get("instance_id"),
                # d.get("width"),
                # d.get("height"),
                # d.get("is_placeholder"),
                # d.get("uuid"),
                # d.get("path"),
                # d.get("containing_comps"),
            )

            ret.append(item)
        return ret


def get_stub():
    """
        Convenience function to get server RPC stub to call methods directed
        for host (Premiere).
        It expects already created connection, started from client.
        Currently created when panel is opened (PS: Window>Extensions>AYON)
    :return: <PremiereServerStub> where functions could be called from
    """
    stub = PremiereServerStub()
    if not stub.client:
        raise ConnectionNotEstablishedYet("Connection is not created yet")

    return stub
