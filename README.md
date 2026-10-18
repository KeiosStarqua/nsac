# NASA public data — Open-Innovation Tour for Space Apps 2019

Source: [Open-Innovation_Tour_for_Space_Apps_2019](https://docs.google.com/presentation/d/10xoC0N1jWOxEFwGml-Ivnn6GYxJ2_tbAZjdl7aRzaI8/edit?slide=id.g61f57fe376_0_30#slide=id.g61f57fe376_0_30) (Justin Gosses, SAIC, supporting NASA OCIO). The link opens slide 2, the title slide. Figures below are from the 2019 talk; the deck was last modified 21 Sep 2021.

## Linked slide

**A Tour of NASA’s Data Universe** for a Space-Apps audience.

Justin Gosses, S.A.I.C. senior data scientist, Office of the Chief Information Officer, Transformation & Data Division.

Speaker notes: he supports the open-innovation program that publishes a lot of NASA’s public data, and the talk is a short tour of that data universe.

## Open-innovation sites

Agency-wide collectors run by the Office of the Chief Information Officer. Open-government mandate driven.

| Site | Role (as of the talk) |
|---|---|
| [open.nasa.gov](https://open.nasa.gov) | Landing page for the program, mandates, blog, news |
| [api.nasa.gov](https://api.nasa.gov) | Passthrough for easier NASA APIs, tracked by api.data.gov. 17 APIs (patents, exoplanets, satellite imagery, handheld camera, Mars, and others). 55,000 API keys since 2015. 9 million hits in May 2019. Does not list every NASA API. |
| [data.nasa.gov](https://data.nasa.gov) | Started July 2014. ~20K unique users, ~40K datasets, ~23K page views that month. Mostly links harvested from other sites, then harvested into data.gov. |
| [code.nasa.gov](https://code.nasa.gov) | 555+ open-source projects from the Software Release System (Office of the Chief Engineer). Most, not all, are also on github.com/nasa. Built from `code.json`, also available via the code.gov API. |
| [github.com/nasa](https://github.com/nasa) | Public code. Some projects are on GitLab or under other orgs, not `nasa`. |

Repos that accept pull requests: [nasa/api-docs](https://github.com/nasa/api-docs), [nasa/code-nasa-gov](https://github.com/nasa/code-nasa-gov). Staffing in the talk: thousands of contributors, about 2.5 developers maintaining the sites.

## Why data is scattered

1. Congress and the White House mandate agency-wide open sites (code, API, data) that harvest other sites. Example: Federal Data Strategy.
2. Science grants require deposit in a domain archive. Example: Earth Science.
3. Other systems need the data in a specific database or API. Example: 3D moon-rock scans with no open-source renderer.

Harvest path: small or project files and domain archives (for example earthdata.nasa.gov, the APOD site) roll up to api.nasa.gov and data.nasa.gov, then to data.gov (~236,000 datasets then). Some datasets never make it, and a domain site is often easier to search than data.gov.

## Domain sites

1. Planetary Data System — data from other planets
2. Earth Observations — mostly satellite Earth data
3. Astromaterials — dust, comets, meteorites, moon rocks, 3D models, impacts
4. Solar power datasets and APIs
5. Global near-Earth observations — solar flux, rain, and similar maps
6. Soil moisture
7. NODIS — NASA Online Directives Information System
8. STI — papers and reports ([sti.nasa.gov](https://sti.nasa.gov))
9. NASA Technology Transfer — software, patents, tools, small business
10. USGS and NOAA — Earth imagery
11. USGS and NOAA — climate data

Longer list: [nasa.gov/open/data.html](https://www.nasa.gov/open/data.html)

## Usage at the time of the talk

Easiest datasets to work with, by usage on the open-innovation sites:

- Code clones, prior 2 weeks: openmct 281, earthdata-search 212
- API downloads, May: APOD 9,520,397; NEO 508,207; mars-photos 195,953
- Dataset downloads: Meteorite Landings 49,000; NASA Facilities 34,000; Global Landslide Catalog Export 29,000; Surface Meteorology and Solar Energy 22,000

## Starter code

- Datanauts GitHub org
- GitHub search for `NASA` (~10,000 repos then)
- Observable notebooks (NASA collection) and [this notebook](https://observablehq.com/d/d2f8833d92e1ea66)
- ~5,000 past Space Apps projects, via an app by Alexandre Belloni Alves
- bl.ocks.org, search `nasa`

## Search advice

- **Finding** (you know the name): data.nasa.gov and string match on titles.
- **Discovery** (you do not know what exists): domain or project sites with visuals, not a generic catalog.
- data.nasa.gov is a harvest site: format filters, tags, and types are incomplete, so a CSV or tag search misses a lot.
- API docs are often not on the first page; data.nasa.gov datasets sometimes have their own APIs.
- Site types: harvest catalogs (data.nasa.gov) suit string search; domain archives (pds.nasa.gov) suit filters; a single-dataset site (Insight Mars Weather API) suits example use cases.

## Worked example: lunar sample evaluation

Challenge: choose which Moon samples to return.

- Johnson Space Center Astromaterials Group Apollo sample database
- STI paper: *GeoLab Concept: The Importance of Sample Selection During Long Duration Human Exploration Mission*
- data.nasa.gov report: *SAND-E: Semi-Autonomous Navigation for Detrital Environments*

## Tech stack (NSAC)

Thứ tự và link dưới đây là stack dự kiến cho dự án; mỗi URL đã mở thử **2026-10-18**.

### Chạy model offline

| Thành phần | Link | Ghi chú |
|---|---|---|
| Ollama | [github.com/ollama/ollama](https://github.com/ollama/ollama) | MIT |
| llama.cpp | [github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) | MIT, dự phòng |
| Qwen3.6-35B-A3B | [huggingface.co/Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) | cho máy 32 GB |
| Qwen3.5-9B | [huggingface.co/Qwen/Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) | cho máy 16 GB |
| MedPsy-4B-GGUF | [huggingface.co/qvac/MedPsy-4B-GGUF](https://huggingface.co/qvac/MedPsy-4B-GGUF) | chuyên gia y khoa; chạy llama.cpp và Ollama |

### Agent có bước người duyệt

| Thành phần | Link | Ghi chú |
|---|---|---|
| LangGraph | [github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | MIT |

### Tra tài liệu NASA

| Thành phần | Link | Ghi chú |
|---|---|---|
| Docling | [github.com/docling-project/docling](https://github.com/docling-project/docling) | MIT, đọc PDF |
| Qwen3-Embedding-0.6B | [huggingface.co/Qwen/Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | Apache 2.0, embedding |
| Chroma | [github.com/chroma-core/chroma](https://github.com/chroma-core/chroma) | Apache 2.0, vector DB |
| ISS Medical Checklist (bản sao) | [newspaceeconomy.ca/.../163533main_iss_med_cl.pdf](https://newspaceeconomy.ca/wp-content/uploads/2022/11/163533main_iss_med_cl.pdf) | link gốc nasa.gov đã chết |

### Phát hiện lệch

| Thành phần | Link | Ghi chú |
|---|---|---|
| pandas | [github.com/pandas-dev/pandas](https://github.com/pandas-dev/pandas) | BSD |
| statsmodels | [github.com/statsmodels/statsmodels](https://github.com/statsmodels/statsmodels) | BSD |
| ruptures | [github.com/deepcharles/ruptures](https://github.com/deepcharles/ruptures) | BSD, điểm đổi xu hướng |

### Tín hiệu tim

| Thành phần | Link | Ghi chú |
|---|---|---|
| NeuroKit2 | [github.com/neuropsychology/NeuroKit](https://github.com/neuropsychology/NeuroKit) | MIT |

### Dữ liệu NASA

| Thành phần | Link | Ghi chú |
|---|---|---|
| OSD-569 | [osdr.nasa.gov/.../OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) | công thức máu Inspiration4 |
| OSD-575 | [osdr.nasa.gov/.../OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | chuyển hóa và chỉ số viêm |
| API dữ liệu OSDR | [visualization.osdr.nasa.gov/biodata/api/](https://visualization.osdr.nasa.gov/biodata/api/) | |
| DONKI | [ccmc.gsfc.nasa.gov/tools/DONKI/](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | bão Mặt Trời |

### Giao diện

| Thành phần | Link | Ghi chú |
|---|---|---|
| NiceGUI | [github.com/zauberzeug/nicegui](https://github.com/zauberzeug/nicegui) | MIT |

### Báo cáo và đóng gói

| Thành phần | Link | Ghi chú |
|---|---|---|
| Jinja2 | [github.com/pallets/jinja](https://github.com/pallets/jinja) | BSD |
| WeasyPrint | [github.com/Kozea/WeasyPrint](https://github.com/Kozea/WeasyPrint) | BSD, xuất PDF |
| uv | [github.com/astral-sh/uv](https://github.com/astral-sh/uv) | quản lý thư viện Python |
