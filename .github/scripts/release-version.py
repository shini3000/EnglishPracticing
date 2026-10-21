"""Plan manually approved stable releases; no dependencies or remote writes."""

import argparse
import re
import subprocess


def parse_tag(tag):
    match = re.fullmatch(r"v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", tag)
    if not match:
        raise ValueError(f"Invalid stable version tag: {tag!r}")
    return tuple(map(int, match.groups()))


def next_version(tags, bump="patch", requested=None):
    if bump not in ("patch", "minor", "major"):
        raise ValueError("Choose patch, minor or major")
    versions = []
    for tag in tags:
        try:
            versions.append(parse_tag(tag))
        except ValueError:
            continue
    if requested:
        version = parse_tag(requested)
        if version < (1, 0, 0):
            raise ValueError("Stable releases start at 1.0.0")
        if versions and version < max(versions):
            raise ValueError("Cannot release a version older than an existing stable tag")
    elif not versions:
        version = (1, 0, 0)
    else:
        major, minor, patch = max(versions)
        version = {
            "patch": (major, minor, patch + 1),
            "minor": (major, minor + 1, 0),
            "major": (major + 1, 0, 0),
        }[bump]
    return ".".join(map(str, version))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bump", choices=("patch", "minor", "major"), default="patch")
    parser.add_argument("--tag")
    args = parser.parse_args()
    tags = subprocess.check_output(["git", "tag", "--list"], text=True).splitlines()
    print(next_version(tags, args.bump, args.tag))
