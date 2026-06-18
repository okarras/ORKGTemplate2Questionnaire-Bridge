# Contributing to Dynamic Questionnaire Generator

We love your input! We want to make contributing to the Dynamic Questionnaire Generator as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Issues

Issues are a great way to keep track of tasks, enhancements, and bugs for our project. We use GitHub issues to track all changes and discussions.

#### Creating Issues

We use a **hybrid workflow**: structured GitHub templates plus optional AI expansion from a rough note.

**Quick path (recommended)**

1. Write one or two sentences describing the problem or idea.
2. Expand it using one of:
   - **GitHub Copilot** (VS Code / github.com): e.g. `Create a bug report: PDF export fails on nested templates`
   - **CLI script** (uses keys from `.env.local`):
     ```sh
     npm run issue:enhance -- --type bug --text "your rough description"
     npm run issue:enhance -- --type feature --text "export answers as CSV" --create
     ```
   - **Cursor**: ask the agent to draft an issue following `.github/copilot-instructions.md`
3. Open [New Issue](https://github.com/okarras/ORKGTemplate2Questionnaire-Bridge/issues/new/choose), pick the matching template, and paste the result.

**Issue templates** (`.github/ISSUE_TEMPLATE/`):

| Template             | `--type`   | Labels                    |
| -------------------- | ---------- | ------------------------- |
| Bug Report           | `bug`      | `bug`, `triage`           |
| Feature Request      | `feature`  | `enhancement`, `triage`   |
| Documentation        | `docs`     | `documentation`, `triage` |
| Refactor / Tech Debt | `refactor` | `refactor`, `triage`      |

**Manual path**

1. **Use Issue Templates**: Pick the appropriate template on GitHub
2. **Clear Title**: Prefix with `[Bug]:`, `[Feature]:`, `[Docs]:`, or `[Refactor]:`
3. **Detailed Description**: Include expected vs actual behavior (bugs), acceptance criteria (features), or scope (refactors)
4. **Labels**: Applied automatically by templates where configured

Copilot and the enhance script follow guidance in [`.github/copilot-instructions.md`](../.github/copilot-instructions.md). Keep issues **concise and specific** (~125 words) for best results with AI coding agents.

### Branch Naming Convention

All branch names should follow this format:

```
<type>/<short-description>
```

Where `type` can be:

- `feature` - New feature or enhancement
- `bugfix` - Bug fix
- `hotfix` - Critical fix for production
- `docs` - Documentation updates
- `refactor` - Code refactoring
- `test` - Adding or modifying tests

Example: `feature/pdf-export-metadata`

### Git Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

Example commit messages:

```
feat(questionnaire): add CSV export for filled answers
fix(pdf): resolve nested template field mapping
docs: update ORKG sandbox setup instructions
```

### Pull Request Process

1. **Branch Creation**
   - Create a new branch from `main` using the naming convention above
   - Keep your branch focused on a single feature or fix

2. **Development**
   - Write clean, documented, and tested code
   - Follow the project's code style and conventions
   - Keep commits atomic and follow commit message guidelines

3. **Before Submitting**
   - Update the README.md with details of changes if needed
   - Ensure lint passes (`npm run lint`)
   - Update documentation as needed
   - Verify your changes locally

4. **Submitting**
   - Create a Pull Request with a clear title and description
   - Link any related issues
   - Request review from maintainers
   - Address review comments promptly

5. **Merging**
   - PRs require at least one approval from maintainers
   - All CI checks must pass
   - Commits should be squashed if necessary

### Architecture & Conventions

Key conventions:

- **UI vs logic**: components render; hooks and `lib/` modules handle data and side effects
- **ORKG data**: template fetching and SPARQL live in `lib/` and `app/api/orkg/`
- **Questionnaire**: ScidQuest integration in `components/questionnaire/` and `lib/orkg-to-scidquest-adapter.ts`
- **AI**: server-side only via `app/api/ai/generate` — never expose API keys client-side
- **Smallest correct change**: match surrounding patterns; avoid unrelated refactors

### Code Style

- Follow consistent code formatting
- Write clear, self-documenting code
- Include comments for complex logic
- Follow TypeScript and Next.js best practices

### Testing

- Verify questionnaire flows manually against real ORKG templates when possible
- Test PDF and JSON export after form changes
- Ensure lint passes before submitting PR

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team. All complaints will be reviewed and investigated promptly and fairly.

## License

By contributing, you agree that your contributions will be licensed under the project's license.

## Questions?

Don't hesitate to ask questions by creating an issue or contacting the maintainers directly.
