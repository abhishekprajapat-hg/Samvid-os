import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllLeads } from "../../services/leadService";
import { getTasks, updateTask } from "../../services/taskService";
import { toErrorMessage } from "../../utils/errorMessage";
import FieldOverview from "./components/FieldOverview";

const DASHBOARD_LEAD_FIELDS = [
  "_id", "name", "city", "preferredLocations", "projectInterested", "status",
  "brokerageReceived", "nextFollowUp", "followUpPurpose", "createdAt", "updatedAt",
].join(",");

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const FieldDashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const userId = String(user?._id || user?.id || "").trim();
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskId, setSavingTaskId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const [leadResult, taskResult] = await Promise.allSettled([
      // The API is paginated (50 by default). Walk every role-scoped page,
      // including leads assigned through assignedFieldExecutive.
      getAllLeads({ fields: DASHBOARD_LEAD_FIELDS }),
      getTasks(),
    ]);

    if (leadResult.status === "fulfilled") setLeads(Array.isArray(leadResult.value) ? leadResult.value : []);
    else {
      setLeads([]);
      setError(toErrorMessage(leadResult.reason, "Could not load assigned leads"));
    }
    if (taskResult.status === "fulfilled") setTasks(Array.isArray(taskResult.value) ? taskResult.value : []);
    else {
      setTasks([]);
      setError((previous) => previous || toErrorMessage(taskResult.reason, "Could not load tasks"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const completeTask = async (taskId) => {
    if (!taskId || savingTaskId) return;
    setSavingTaskId(String(taskId));
    setError("");
    try {
      const updated = await updateTask(taskId, { status: "COMPLETED" });
      setTasks((current) => current.map((task) => String(task._id) === String(taskId)
        ? { ...task, ...(updated || {}), status: "COMPLETED" }
        : task));
    } catch (taskError) {
      setError(toErrorMessage(taskError, "Could not complete the task"));
    } finally {
      setSavingTaskId("");
    }
  };

  const openPage = (page, id) => {
    const paths = { leads: "/my-leads", tasks: "/tasks", map: "/map", calendar: "/calendar" };
    if (page === "lead" && id) navigate(`/my-leads/${id}`);
    else if (page === "task") navigate("/tasks");
    else navigate(paths[page] || "/");
  };

  return (
    <div className="field-dashboard-page flex h-full w-full min-h-0 flex-col overflow-hidden">
      <FieldOverview
        userId={userId}
        leads={leads}
        tasks={tasks}
        loading={loading}
        error={error}
        savingTaskId={savingTaskId}
        onRefresh={loadDashboard}
        onCompleteTask={completeTask}
        onOpen={openPage}
      />
    </div>
  );
};

export default FieldDashboard;
