"""
Requires:
    None

Provides:
    context.data["currentFile"] ->  absolute path for workfile
"""
import os

import pyblish.api

from ayon_premiere.api import get_stub


class CollectCurrentFile(pyblish.api.ContextPlugin):
    """Inject the current working file path into context"""

    order = pyblish.api.CollectorOrder - 0.49
    label = "Current File"
    hosts = ["premiere"]

    def process(self, context):
        context.data["currentFile"] = os.path.normpath(
            get_stub().get_active_document_full_name()
        ).replace("\\", "/")
