# -*- coding: utf-8 -*-
"""Migrate the three .docx media lists into data/{region}.json.

Source format is one entry per paragraph:

    名字(进度) 看完了 (备注)

The first parenthesised group is the progress, any later group plus the
loose tail text becomes the note, and watch/status are inferred from the
Chinese markers found in that tail. The originals are never modified.
"""
import json
import os
import re
import sys
import uuid
import zipfile
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

OPEN, CLOSE = "(（", ")）"

# Korean manhwa sitting inside 中国和韩国漫画.docx. Everything else in that
# file is treated as 中国; the app's edit dialog can move any row afterwards.
KOREAN = {
    "被塔詛咒的獵人",
    "归还者的魔法要特别",
    "全知读者视角",
    "我独自升级",
    "学士再生",
}
# Plausibly Korean but not confident enough to move automatically.
UNSURE = {"从1级开始的异世界骑士", "怎麼辦！我穿越成了最弱小野怪"}

WATCH_TOKENS = ("看完了", "看着", "未看")


def paragraphs(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    out = []
    for para in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        text = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", para, re.S))
        text = (text.replace("&amp;", "&").replace("&lt;", "<")
                    .replace("&gt;", ">").replace("&quot;", '"')
                    .replace("&#39;", "'"))
        if text.strip():
            out.append(text.strip())
    return out


def split_groups(line):
    """Return (name, [group contents], tail text outside the groups)."""
    groups, tail, depth, buf, first = [], [], 0, [], None
    for i, ch in enumerate(line):
        if ch in OPEN:
            if depth == 0:
                if first is None:
                    first = i
                buf = []
            else:
                buf.append(ch)
            depth += 1
        elif ch in CLOSE and depth > 0:
            depth -= 1
            if depth == 0:
                groups.append("".join(buf))
            else:
                buf.append(ch)
        elif depth > 0:
            buf.append(ch)
        else:
            tail.append(ch)
    if depth > 0:            # unbalanced paren: treat the rest as tail
        groups.append("".join(buf))
    name = line[:first] if first is not None else "".join(tail)
    return name.strip(), groups, "".join(tail)[len(name.strip()):].strip()


def clean_note(parts):
    return " / ".join(p.strip() for p in parts if p and p.strip())


def parse(line, source):
    name, groups, tail = split_groups(line)
    progress = groups[0].strip() if groups else ""
    note_parts = [g for g in groups[1:]]

    # "我独自升级(看完了)" — the first group is a watch marker, not progress.
    if progress in WATCH_TOKENS:
        tail = progress + " " + tail
        progress = ""

    blob = tail + " " + clean_note(note_parts)
    # "看完了" contains "完了" — strip watch markers before testing series status,
    # otherwise every caught-up row would look like a concluded series.
    status_blob = blob
    for token in WATCH_TOKENS:
        status_blob = status_blob.replace(token, " ")

    # --- watch state -------------------------------------------------
    if "看着" in blob:
        watch = "看着"
    elif "看完了" in blob or "完结了" in blob or "完了" in blob:
        watch = "看完了"
    elif source == "anime":
        watch = "看完了"          # the whole doc is anime already watched
    else:
        watch = "看着"

    # --- series status ----------------------------------------------
    season_done = re.search(r"第[一二三四五六七八九十\d]+季\s*完", status_blob)
    ended = ("完结" in status_blob or "完結" in status_blob
             or "完了" in status_blob) and not season_done
    ongoing = any(t in status_blob for t in ("正常更新", "停更", "休刊", "腰斩",
                                             "没完", "沒完", "被收购", "版权被买"))

    if source == "anime":
        if re.search(r"无望|無望|渺茫|凉了", blob):
            status = "完结"
        elif re.search(r"还有第|還有第|有望|出了第", blob):
            status = "未完结"
        elif re.search(r"连载|連載", blob):
            status = "未完结"
        else:
            status = "完结"
    elif source == "manga-jp":
        if ongoing:
            status = "未完结"
        elif ended or watch == "看完了":
            status = "完结"
        else:
            status = "未完结"
    else:  # manga-cn / manga-kr
        status = "完结" if ended and not ongoing else "未完结"

    # --- category ----------------------------------------------------
    if source == "anime":
        category = "电影" if "剧场版" in progress or "劇場版" in progress else "动画"
    else:
        category = "漫画"

    # Non-numeric progress blurbs ("神兵界篇-身份暴露") are notes, not progress.
    if progress and not re.search(r"\d", progress) and progress not in ("剧场版", "劇場版", "短篇"):
        note_parts.insert(0, progress)
        progress = ""

    return {
        "name": name,
        "progress": progress,
        "watch": watch,
        "status": status,
        "category": category,
        "url": "",
        "note": clean_note(note_parts + ([tail] if tail and not any(
            t in tail for t in WATCH_TOKENS) else [])),
    }


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


SOURCES = [
    ("日本动画.docx", "anime", "日本"),
    ("看过的日本漫画.docx", "manga-jp", "日本"),
    ("中国和韩国漫画.docx", "manga-cn", None),   # region decided per row
]

REGIONS = ["日本", "中国", "韩国", "欧美"]


def main():
    buckets = {r: [] for r in REGIONS}
    report = {"korean": [], "unsure": [], "movies": []}

    for filename, source, fixed_region in SOURCES:
        path = os.path.join(ROOT, filename)
        stamp = iso(os.path.getmtime(path))
        for line in paragraphs(path):
            item = parse(line, source)
            if not item["name"]:
                print("  ! skipped (no name):", repr(line))
                continue

            region = fixed_region
            if region is None:
                if item["name"] in KOREAN:
                    region = "韩国"
                    report["korean"].append(item["name"])
                else:
                    region = "中国"
                    if item["name"] in UNSURE:
                        report["unsure"].append(item["name"])
            if item["category"] == "电影":
                report["movies"].append(item["name"])

            # Same key order the app's normalise() produces, so simply opening
            # MediaLog never rewrites these files into a huge no-op diff.
            buckets[region].append({
                "id": str(uuid.uuid4()),
                "name": item["name"],
                "progress": item["progress"],
                "watch": item["watch"],
                "status": item["status"],
                "category": item["category"],
                "url": item["url"],
                "note": item["note"],
                "createdAt": stamp,
                "updatedAt": stamp,
            })

    now = iso(datetime.now(timezone.utc).timestamp())
    os.makedirs(DATA, exist_ok=True)
    for region in REGIONS:
        items = buckets[region]
        payload = {"region": region, "version": 1, "updatedAt": now, "items": items}
        out = os.path.join(DATA, region + ".json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        cats = {}
        for it in items:
            cats[it["category"]] = cats.get(it["category"], 0) + 1
        print(f"{region+'.json':>14}  {len(items):>4} items  {cats}")

    print("\n韩国 (moved out of 中国和韩国漫画.docx):")
    for n in report["korean"]:
        print("   -", n)
    print("\nPossibly Korean, left in 中国 — flip in the app if you disagree:")
    for n in report["unsure"]:
        print("   -", n)
    print("\nFiled as 电影 (剧场版):")
    for n in report["movies"]:
        print("   -", n)


if __name__ == "__main__":
    main()
