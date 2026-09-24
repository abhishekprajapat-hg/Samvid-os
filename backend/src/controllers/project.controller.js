const {
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectList,
  parsePagination,
  buildPaginationMeta,
} = require("../services/project.service");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("Project route error:", error);
  }
  return res.status(statusCode).json({ message: error.message || "Something went wrong" });
};

exports.getProjects = async (req, res) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: Number.parseInt(process.env.PROJECT_PAGE_LIMIT, 10) || 25,
      maxLimit: Number.parseInt(process.env.PROJECT_PAGE_MAX_LIMIT, 10) || 200,
    });

    const { rows, totalCount } = await getProjectList({
      user: req.user,
      filters: {
        projectCategory: req.query?.projectCategory,
        projectType: req.query?.projectType,
        status: req.query?.status,
        search: req.query?.search,
        createdBy: req.query?.createdBy,
      },
      pagination,
    });

    return res.status(200).json({
      count: rows.length,
      projects: rows,
      pagination: pagination.enabled
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, totalCount })
        : undefined,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getProject = async (req, res) => {
  try {
    const project = await getProjectById({ user: req.user, projectId: req.params.id });
    return res.status(200).json({ project });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createProject = async (req, res) => {
  try {
    const project = await createProject({ user: req.user, payload: req.body });
    return res.status(201).json({ project });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await updateProject({
      user: req.user,
      projectId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ project });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await deleteProject({ user: req.user, projectId: req.params.id });
    return res.status(200).json({ message: "Project deleted" });
  } catch (error) {
    return handleError(res, error);
  }
};
