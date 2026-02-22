# Dynamic Questionnaire Generator

_"A tool that bridges ORKG templates and questionnaires by enabling automated generation in both directions. Developed within the SciD‑QuESt project, it supports FAIR, reproducible, and machine‑actionable research workflows by transforming structured scholarly knowledge into practical survey instruments — and vice versa."_

[![GitHub - Project](https://img.shields.io/badge/GitHub-Project-2ea44f)](https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge) [![Issues - Bug Report](https://img.shields.io/badge/Issues-Bug_Report-2ea44f)](https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge/issues) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

# Table of Contents

- [Dynamic Questionnaire Generator](#dynamic-questionnaire-generator)
- [Table of Contents](#table-of-contents)
- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Folder Structure and Files](#folder-structure-and-files)
- [Installation Instructions](#installation-instructions)
  - [1. Ensure prerequisites are installed](#1-ensure-prerequisites-are-installed)
  - [2. Clone the repository](#2-clone-the-repository)
  - [3. Navigate to the main project directory](#3-navigate-to-the-main-project-directory)
  - [4. Install dependencies](#4-install-dependencies)
  - [5. Run the development server](#5-run-the-development-server)
  - [6. Open the application in your browser](#6-open-the-application-in-your-browser)
- [Repository Links](#repository-links)
- [Authors](#authors)
- [How to Cite](#how-to-cite)

# About the Project

Dynamic Questionnaire Generator is a web application that dynamically generates questionnaires from [Open Research Knowledge Graph (ORKG)](https://orkg.org) templates. Users can search and select any ORKG template, and the system automatically produces an interactive questionnaire based on the template's structure, properties, and metadata. The application supports nested templates, resource autocomplete from ORKG, and export of filled answers as JSON or fillable PDF forms. It promotes FAIR and Open Science by making scholarly knowledge structures accessible and reusable through practical survey instruments.

# Key Features

- **Template Selection & Search** — Browse and search ORKG templates with live filtering
- **Dynamic Questionnaire Generation** — Automatically generate questionnaires from any ORKG template structure
- **Nested Templates** — Full support for recursively nested template properties and subtemplates
- **ORKG Integration** — Resource autocomplete, predicate links, and class-based value suggestions from the ORKG SPARQL endpoint
- **Export Options** — Export filled answers as JSON or generate fillable PDF forms with proper metadata
- **Responsive UI** — Modern interface built with HeroUI and Tailwind CSS, with light/dark theme support

# Folder Structure and Files

| **Directory / File**       | **Description**                                      |
| -------------------------- | ---------------------------------------------------- |
| [app/](app/)               | Next.js App Router pages and API routes              |
| [app/api/orkg/](app/api/orkg/) | ORKG API proxies (resources, SPARQL)                 |
| [app/api/templates/](app/api/templates/) | Template list and single-template endpoints          |
| [app/questionnaire/](app/questionnaire/)   | Dynamic questionnaire page by template ID            |
| [components/](components/) | React components (questionnaire, footer, etc.)        |
| [components/questionnaire/](components/questionnaire/) | Questionnaire form, field inputs, PDF export         |
| [config/](config/)        | Site configuration, theme, fonts                      |
| [lib/](lib/)              | ORKG template fetching, SPARQL queries, preprocessing |
| [types/](types/)          | TypeScript type definitions                          |
| [package.json](package.json) | Project dependencies and npm scripts                 |

# Installation Instructions

## 1. Ensure prerequisites are installed

- **Node.js** (version 18 or higher recommended)
- **Modern web browser** (e.g., Chrome, Firefox)
- **Git** (optional, for version control)

## 2. Clone the repository

```sh
git clone https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge.git
```

## 3. Navigate to the main project directory

```sh
cd ORKGTemplate2Questionnaire-Bridge
```

## 4. Install dependencies

Using **npm**:

```sh
npm install
```

## 5. Run the development server

Using **npm**:

```sh
npm run dev
```

## 6. Open the application in your browser

Visit:

```
http://localhost:3000
```

# Repository Links

- **Dynamic Questionnaire Generator**: <https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge>
- **ORKG**: <https://orkg.org>
- **EmpiRE-Compass** (related): <https://github.com/okarras/EmpiRE-Compass>

# Authors

- **Amirreza Alasti** — Leibniz University of Hannover
- **Oliver Karras** — TIB - Leibniz Information Centre for Science and Technology (Open Research Knowledge Graph)

# How to Cite

If you want to cite this project, we suggest using the following reference:

> Amirreza Alasti and Oliver Karras: **ORKG Template 2 Questionnaire Bridge - Dynamic Questionnaire Generator**, Computer Software, <https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge>, 2026.

---

Licensed under the [MIT license](LICENSE).
