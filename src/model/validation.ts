import { z } from 'zod'
import { SUPPORTED_VERSIONS } from './constants.js'
import { RepoTodoStates } from './model.repostate.js'

const zTodo = z.object({
  fileName: z.string(),
  lineNumber: z.number().int(),
  rawLine: z.string(),
  keyword: z.string(),
  issueNumber: z.number().int().optional(),
  todoText: z.string(),
  foundInCommit: z.string().optional(),
  doneInCommit: z.string().optional(),
})
export type TTodo = z.infer<typeof zTodo>

const zFeatureBranchState = z.object({
  name: z.string(),
  commitSha: z.string(),
  todos: z.array(zTodo),
})
export type TFeatureBranchState = z.infer<typeof zFeatureBranchState>

const zDefaultBranchState = z.object({
  todos: z.array(zTodo),
})
export type TDefaultBranchState = z.infer<typeof zDefaultBranchState>

const zTodoState = z.object({
  commentId: z.number().int().optional(),
  deadIssue: z.boolean().optional(),
  defaultBranch: zDefaultBranchState.optional(),
  featureBranch: zFeatureBranchState.optional(),
})
export type TTodoState = z.infer<typeof zTodoState>

const zIntegerString = z.string().regex(/^[0-9]+$/)
const zSupportedVersions = z.enum(SUPPORTED_VERSIONS, {
  invalid_type_error: 'Unsupported Data Format Version: This Todohub version supports only versions: ["1"]',
})
export type TSupportedVersions = z.infer<typeof zSupportedVersions>

const zTodoStates = z.record(zIntegerString, zTodoState)

export const zRepoTodoStates = z.object({
  version: zSupportedVersions,
  todoStates: zTodoStates,
  lastUpdatedDefaultCommit: z.string().optional(),
  trackedDefaultBranch: z.string().optional(),
}).transform((obj) => new RepoTodoStates(
  obj.version,
  obj.todoStates,
  obj.lastUpdatedDefaultCommit,
  obj.trackedDefaultBranch),
)
export type TRepoTodoStates = z.infer<typeof zRepoTodoStates>
