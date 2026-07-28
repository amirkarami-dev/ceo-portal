import type { ToolKey } from "@mabhas19/assessment-core"
import { EnvOpaqueEditor } from "./EnvOpaqueEditor"
import { EnvTransEditor } from "./EnvTransEditor"
import { GroupChecklistEditor } from "./GroupChecklistEditor"
import { IntegratedEditor } from "./IntegratedEditor"
import { MonitoringEditor } from "./MonitoringEditor"
import type { EditorProps } from "./shared"

// Routes a tool to its RN editor. All six checklists are now editable on mobile.
export function ChecklistEditor({ toolKey, ...props }: EditorProps & { toolKey: ToolKey }) {
  switch (toolKey) {
    case "env_opaque.html":
      return <EnvOpaqueEditor {...props} />
    case "env_trans.html":
      return <EnvTransEditor {...props} />
    case "mech_checklist.html":
      return <GroupChecklistEditor variant="mech" {...props} />
    case "elec_checklist.html":
      return <GroupChecklistEditor variant="elec" {...props} />
    case "monitoring_checklist.html":
      return <MonitoringEditor {...props} />
    case "integrated_mgmt.html":
      return <IntegratedEditor {...props} />
    default:
      return null
  }
}
