"""
Requires:
    None

Provides:
    instance.data["representations"] ->  workfile representation
"""

import os

import pyblish.api


class CollectWorkfile(pyblish.api.ContextPlugin):
    """ Adds 'workfile' representation if instance is published. """

    label = "Collect Premiere Workfile Instance"
    order = pyblish.api.CollectorOrder + 0.1

    def process(self, context):
        workfile_instance = None
        for instance in context:
            if instance.data["productType"] == "workfile":
                self.log.debug("Workfile instance found")
                workfile_instance = instance
                break

        if workfile_instance is None:
            self.log.debug("Workfile instance not found. Skipping")
            return

        current_file = context.data["currentFile"]
        staging_dir = os.path.dirname(current_file)
        scene_file = os.path.basename(current_file)

        # creating representation
        workfile_instance.data["representations"].append({
            "name": "prproj",
            "ext": "prproj",
            "files": scene_file,
            "stagingDir": staging_dir,
        })
