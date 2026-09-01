---
name: data-fetching-architecture
description: 'nest-pure-front-react（LobeHub fork）数据获取管线指南。用于 service 层、Zustand store、SWR、apiFetch(REST→nest-admin)、lambdaClient(tRPC 遗留链路)、useClientDataSWR、useFetchXxx hooks，或把 useEffect 抓取迁移到 store SWR。'
user-invocable: false
---

# Data Fetching Architecture

> **Related:** `store-data-structures` covers List vs Detail data shape rationale (Map vs Array).
> **Fork context:** see `project-overview` §4 for the backend wiring (`/app/front-hub/*`, `/ai/v1/*`, nginx rewrite).

## ⚠️ 本 fork 的传输层：REST `apiFetch` 优先，tRPC 仅遗留

本仓库的 C 端业务**后端是 nest-admin，不是 LobeHub 自带 Server DB**，因此 service 层有两条传输路径：

| 路径 | 客户端 | 端点 | 适用范围 |
| --- | --- | --- | --- |
| **REST（主路径，新代码一律用它）** | `apiFetch` / `apiStream`（`src/services/_api.ts`） | `/app/front-hub/*`、`/ai/v1/*`、`/system/auth/refresh-token` | 所有 C 端业务：session / topic / message / thread / usage / file / agent / config / notification / user / memory / hitl / harness / marketplace / workspace / agentTeam / quota ... |
| tRPC（遗留） | `lambdaClient` | `apps/server/src/routers/lambda/*` + `/webapi/*` | 上游遗留链路：桌面端、market OIDC、stub 能力（tools/search、mcp、discover、knowledge-bases、devices、plugins、acceptance 后端返回 501，前端靠 tRPC mock） |

当前分布：`apiFetch` 约 29 个文件、`lambdaClient` 约 116 个文件（迁移进行中）。**新增或改写 C 端 service 必须用 `apiFetch`，不要再新增 `lambdaClient` 调用。**

`apiFetch` 使用要点：

```typescript
import { apiFetch } from '../_api';

// nest-admin 统一信封 { code, data, message }，service 内再解一层
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

export class SessionService {
  createSession = async (data: Partial<LobeAgentSession>) =>
    unwrap<{ id: string }>('/app/front-hub/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
}
```

- `API_BASE` 取自 `process.env.NEXT_PUBLIC_API_BASE`（默认空串 = 同域，靠 nginx 反代）
- **无 body 的请求不要带 `Content-Type: application/json`**（DELETE 等会被 Fastify 以 `Body cannot be empty...` 拒绝）——`apiFetch` 已自动处理
- 401 自动用 `localStorage.refreshToken` 打 `/system/auth/refresh-token` 刷新后重试；令牌读写用 `setAuthTokens` / `clearAuthTokens`
- SSE / 流式用 `apiStream`（聊天走 `/ai/v1/chat/completions`，非 `/webapi/chat`）
- `@Bypass` 端点返回原始格式（无 `code/data` 信封），调用方需兼容

本文档后续出现的 `lambdaClient` 规则**仅在维护遗留 tRPC 链路时适用**；其余场景把「service → lambdaClient」读作「service → `apiFetch`」。

## Architecture Overview

```text
┌─────────────┐
│  Component  │
└──────┬──────┘
       │ 1. Call useFetchXxx hook from store
       ↓
┌──────────────────┐
│  Zustand Store   │
│  (State + Hook)  │
└──────┬───────────┘
       │ 2. useClientDataSWR calls service
       ↓
┌──────────────────┐
│  Service Layer   │
│  (xxxService)    │
└──────┬───────────┘
       │ 3. Call lambdaClient
       ↓
┌──────────────────┐
│  lambdaClient    │
│  (TRPC Client)   │
└──────────────────┘
```

## Core Principles

### ✅ DO

1. **Use Service Layer** for all API calls
2. **Use Store SWR Hooks** for data fetching (not useEffect)
3. **Use proper data structures** — see `store-data-structures` skill for List vs Detail patterns
4. **Use `apiFetch` for all C-end REST calls** (`/app/front-hub/*`) — this is the primary transport in this fork
5. **Use `lambdaClient.mutate` / `.query`** only inside service methods, and only for the legacy upstream tRPC paths
6. **Naming convention** — read hooks are `useFetchXxx`, cache invalidation helpers are `refreshXxx` (e.g. `useFetchBenchmarks` / `refreshBenchmarks`). Mutations then chain `refreshXxx()` after the service call.
7. **Streaming**: use `apiStream` against `/ai/v1/chat/completions`, never `/webapi/chat`

### ❌ DON'T

1. **Never use useEffect** for data fetching
2. **Never call `apiFetch` / `lambdaClient`** directly in components or stores — always go through a service
3. **Never use useState** for server data
4. **Never mix data structure patterns** — follow `store-data-structures` skill
5. **Never add new `lambdaClient` calls for C-end features** — the nest-admin REST layer is the target; stub-only capabilities (tools/search, mcp, discover, ...) return 501 and stay on tRPC mock by design

---

## Layer 1: Service Layer

### Purpose

- Encapsulate all API calls to lambdaClient
- Provide clean, typed interfaces
- Single source of truth for API operations

### Service Structure

```typescript
// src/services/agentEval.ts
class AgentEvalService {
  // Query methods - READ operations
  async listBenchmarks() {
    return lambdaClient.agentEval.listBenchmarks.query();
  }

  async getBenchmark(id: string) {
    return lambdaClient.agentEval.getBenchmark.query({ id });
  }

  // Mutation methods - WRITE operations
  async createBenchmark(params: CreateBenchmarkParams) {
    return lambdaClient.agentEval.createBenchmark.mutate(params);
  }

  async updateBenchmark(params: UpdateBenchmarkParams) {
    return lambdaClient.agentEval.updateBenchmark.mutate(params);
  }

  async deleteBenchmark(id: string) {
    return lambdaClient.agentEval.deleteBenchmark.mutate({ id });
  }
}

export const agentEvalService = new AgentEvalService();
```

### Service Guidelines

1. **One service per domain** (e.g., agentEval, ragEval, aiAgent)
2. **Export singleton instance** (`export const xxxService = new XxxService()`)
3. **Method names match operations** (list, get, create, update, delete)
4. **Clear parameter types** (use interfaces for complex params)

---

## Layer 2: Store with SWR Hooks

### Purpose

- Manage client-side state
- Provide SWR hooks for data fetching
- Handle cache invalidation

### State Structure

```typescript
// src/store/eval/slices/benchmark/initialState.ts
export interface BenchmarkSliceState {
  // List data - simple array
  benchmarkList: AgentEvalBenchmarkListItem[];
  benchmarkListInit: boolean;

  // Detail data - map for caching
  benchmarkDetailMap: Record<string, AgentEvalBenchmark>;
  loadingBenchmarkDetailIds: string[];

  // Mutation states
  isCreatingBenchmark: boolean;
  isUpdatingBenchmark: boolean;
  isDeletingBenchmark: boolean;
}
```

> For complete initialState, reducer, and internal dispatch patterns, see the `store-data-structures` skill.

### Actions

```typescript
// src/store/eval/slices/benchmark/action.ts
const FETCH_BENCHMARKS_KEY = 'FETCH_BENCHMARKS';
const FETCH_BENCHMARK_DETAIL_KEY = 'FETCH_BENCHMARK_DETAIL';

export interface BenchmarkAction {
  // SWR Hooks - for data fetching
  useFetchBenchmarks: () => SWRResponse;
  useFetchBenchmarkDetail: (id?: string) => SWRResponse;

  // Refresh methods - for cache invalidation
  refreshBenchmarks: () => Promise<void>;
  refreshBenchmarkDetail: (id: string) => Promise<void>;

  // Mutation actions
  createBenchmark: (params: CreateParams) => Promise<any>;
  updateBenchmark: (params: UpdateParams) => Promise<void>;
  deleteBenchmark: (id: string) => Promise<void>;

  // Internal methods - not for direct UI use
  internal_dispatchBenchmarkDetail: (payload: BenchmarkDetailDispatch) => void;
  internal_updateBenchmarkDetailLoading: (id: string, loading: boolean) => void;
}

export const createBenchmarkSlice: StateCreator<EvalStore, any, [], BenchmarkAction> = (
  set,
  get,
) => ({
  // Fetch list — simple array stored in benchmarkList
  useFetchBenchmarks: () =>
    useClientDataSWR(FETCH_BENCHMARKS_KEY, () => agentEvalService.listBenchmarks(), {
      onSuccess: (data) => {
        set({ benchmarkList: data, benchmarkListInit: true }, false, 'useFetchBenchmarks/success');
      },
    }),

  // Fetch detail — null key disables the request when id is missing
  useFetchBenchmarkDetail: (id) =>
    useClientDataSWR(
      id ? [FETCH_BENCHMARK_DETAIL_KEY, id] : null,
      () => agentEvalService.getBenchmark(id!),
      {
        onSuccess: (data) => {
          get().internal_dispatchBenchmarkDetail({
            type: 'setBenchmarkDetail',
            id: id!,
            value: data,
          });
          get().internal_updateBenchmarkDetailLoading(id!, false);
        },
      },
    ),

  // Refresh methods
  refreshBenchmarks: () => mutate(FETCH_BENCHMARKS_KEY),
  refreshBenchmarkDetail: (id) => mutate([FETCH_BENCHMARK_DETAIL_KEY, id]),

  // CREATE — refresh list after creation
  createBenchmark: async (params) => {
    set({ isCreatingBenchmark: true }, false, 'createBenchmark/start');
    try {
      const result = await agentEvalService.createBenchmark(params);
      await get().refreshBenchmarks();
      return result;
    } finally {
      set({ isCreatingBenchmark: false }, false, 'createBenchmark/end');
    }
  },

  // UPDATE — optimistic update + refresh
  updateBenchmark: async (params) => {
    const { id } = params;

    // 1. Optimistic update
    get().internal_dispatchBenchmarkDetail({
      type: 'updateBenchmarkDetail',
      id,
      value: params,
    });
    // 2. Set loading
    get().internal_updateBenchmarkDetailLoading(id, true);

    try {
      // 3. Call service
      await agentEvalService.updateBenchmark(params);
      // 4. Refresh from server
      await get().refreshBenchmarks();
      await get().refreshBenchmarkDetail(id);
    } finally {
      get().internal_updateBenchmarkDetailLoading(id, false);
    }
  },

  // DELETE — optimistic update + refresh
  deleteBenchmark: async (id) => {
    get().internal_dispatchBenchmarkDetail({ type: 'deleteBenchmarkDetail', id });
    get().internal_updateBenchmarkDetailLoading(id, true);

    try {
      await agentEvalService.deleteBenchmark(id);
      await get().refreshBenchmarks();
    } finally {
      get().internal_updateBenchmarkDetailLoading(id, false);
    }
  },

  // Internal — dispatch to reducer (for detail map)
  internal_dispatchBenchmarkDetail: (payload) => {
    const currentMap = get().benchmarkDetailMap;
    const nextMap = benchmarkDetailReducer(currentMap, payload);

    // Skip set when nothing changed — avoids unnecessary re-renders
    if (isEqual(nextMap, currentMap)) return;
    set({ benchmarkDetailMap: nextMap }, false, `dispatchBenchmarkDetail/${payload.type}`);
  },

  // Internal — update loading state for specific detail
  internal_updateBenchmarkDetailLoading: (id, loading) => {
    set(
      (state) => ({
        loadingBenchmarkDetailIds: loading
          ? [...state.loadingBenchmarkDetailIds, id]
          : state.loadingBenchmarkDetailIds.filter((i) => i !== id),
      }),
      false,
      'updateBenchmarkDetailLoading',
    );
  },
});
```

### Store Guidelines

1. **SWR keys as constants** at top of file
2. **useClientDataSWR** for all data fetching (never useEffect)
3. **onSuccess/onData callback** updates store state
4. **Refresh methods** use `mutate()` to invalidate cache
5. **Loading states** in initialState, updated in onSuccess/onData
6. **Mutations** call service, then refresh relevant cache

---

## Async Failure Boundary Contract

Every read hook returns an SWR response that includes `error` and `mutate`; the surface must
consume them. A success-only init flag (`!isInit`, `!map[id]`, `data ?? []`) is not enough:
when the request fails, that flag often never flips, so the UI paints a permanent skeleton,
a fake empty state, a false `NotFound`, or a confident zero-value metric.

Use the shared UI primitives:

- `AsyncBoundary` for normal loading / error / empty / data surfaces.
- `AsyncError` for custom layouts, detail pages, inline load-more failures, or metrics.

Core precedence for first-load failures:

```tsx
const { data, error, isLoading, mutate } = useFetchXxx();

return (
  <AsyncBoundary
    data={data}
    empty={<EmptyState />}
    error={error}
    isEmpty={!error && data?.length === 0}
    isLoading={isLoading}
    onRetry={() => {
      void mutate();
    }}
  >
    <List items={data ?? []} />
  </AsyncBoundary>
);
```

Rules:

- Check `error` before empty / `NotFound` / zero defaults. Error is not a kind of empty.
- Keep already-loaded content on background revalidation failures; only replace the surface
  when there is no settled data to preserve.
- For detail maps, don't put the error branch after `if (!map[id]) return <Skeleton/>`.
  First-load failures never populate the map, making that error branch unreachable.
- For infinite scroll / load-more, persist a per-bucket `loadMoreError` and render an
  inline Retry row. Do not let an `IntersectionObserver` silently retry while the error is
  still unresolved.
- For merged fetched + static lists, branch on the fetched slice's `error` before merging.
  Static fallback rows can make a failed fetch look like a plausible partial catalog.

## Layer 3: Component Usage

### Fetching List Data

```tsx
// ✅ CORRECT
const BenchmarkList = () => {
  // 1. Get the hook from store
  const useFetchBenchmarks = useEvalStore((s) => s.useFetchBenchmarks);

  // 2. Get list data
  const benchmarks = useEvalStore((s) => s.benchmarkList);
  const isInit = useEvalStore((s) => s.benchmarkListInit);

  // 3. Call the hook (SWR handles the data fetching)
  useFetchBenchmarks();

  // 4. Use the data
  if (!isInit) return <Loading />;
  return (
    <div>
      <h2>Total: {benchmarks.length}</h2>
      {benchmarks.map((b) => (
        <BenchmarkCard key={b.id} {...b} />
      ))}
    </div>
  );
};
```

### Fetching Detail Data

```tsx
// ✅ CORRECT
const BenchmarkDetail = () => {
  const { benchmarkId } = useParams<{ benchmarkId: string }>();

  const useFetchBenchmarkDetail = useEvalStore((s) => s.useFetchBenchmarkDetail);

  // Detail from map
  const benchmark = useEvalStore((s) =>
    benchmarkId ? s.benchmarkDetailMap[benchmarkId] : undefined,
  );

  // Per-item loading
  const isLoading = useEvalStore((s) =>
    benchmarkId ? s.loadingBenchmarkDetailIds.includes(benchmarkId) : false,
  );

  useFetchBenchmarkDetail(benchmarkId);

  if (!benchmark) return <Loading />;
  return (
    <div>
      <h1>{benchmark.name}</h1>
      <p>{benchmark.description}</p>
      {isLoading && <Spinner />}
    </div>
  );
};
```

### Using Selectors (Recommended)

```typescript
// src/store/eval/slices/benchmark/selectors.ts
export const benchmarkSelectors = {
  getBenchmarkDetail: (id: string) => (s: EvalStore) => s.benchmarkDetailMap[id],
  isLoadingBenchmarkDetail: (id: string) => (s: EvalStore) =>
    s.loadingBenchmarkDetailIds.includes(id),
};

// Component with selectors
const BenchmarkDetail = () => {
  const { benchmarkId } = useParams();
  const useFetchBenchmarkDetail = useEvalStore((s) => s.useFetchBenchmarkDetail);
  const benchmark = useEvalStore(benchmarkSelectors.getBenchmarkDetail(benchmarkId!));

  useFetchBenchmarkDetail(benchmarkId);

  return <div>{benchmark && <h1>{benchmark.name}</h1>}</div>;
};
```

### Anti-pattern

```tsx
// ❌ WRONG — Don't use useEffect for data fetching
const BenchmarkList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    lambdaClient.agentEval.listBenchmarks
      .query()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return <div>...</div>;
};
```

### Mutations in Components

```tsx
// Create — global mutation flag drives form loading
const CreateBenchmarkModal = () => {
  const createBenchmark = useEvalStore((s) => s.createBenchmark);
  const isCreating = useEvalStore((s) => s.isCreatingBenchmark);

  const handleSubmit = async (values) => {
    try {
      // Optimistic update + refresh happen inside createBenchmark
      await createBenchmark(values);
      message.success('Created successfully');
      onClose();
    } catch (error) {
      message.error('Failed to create');
    }
  };

  return (
    <Form onSubmit={handleSubmit} loading={isCreating}>
      ...
    </Form>
  );
};

// Update / delete — per-item loading so only the row being mutated spins
const BenchmarkItem = ({ id }: { id: string }) => {
  const updateBenchmark = useEvalStore((s) => s.updateBenchmark);
  const deleteBenchmark = useEvalStore((s) => s.deleteBenchmark);
  const isLoading = useEvalStore(benchmarkSelectors.isLoadingBenchmarkDetail(id));

  const handleUpdate = async (data) => {
    await updateBenchmark({ id, ...data });
  };

  const handleDelete = async () => {
    await deleteBenchmark(id);
  };

  return (
    <div>
      {isLoading && <Spinner />}
      <button onClick={handleUpdate}>Update</button>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
};
```

**Why two patterns:** create has no id yet, so a single `isCreatingXxx` flag is enough. Update/delete target a specific row, so global flags would freeze unrelated rows — keep per-item state in `loadingXxxIds`.

---

## Need a fuller worked example?

The canonical `Benchmark` example above is the one to copy for a flat list + detail map. If you need to maintain a list **keyed by a parent id** (e.g. `datasetMap[benchmarkId]` because the same shape appears under multiple parents), read [`references/walkthrough.md`](./references/walkthrough.md) — it walks through the full 6 steps (service → reducer → slice → store wiring → selectors → component) for that variant.

---

## Common Patterns

### Pattern 1: Pagination

Cache key array must include every parameter that should trigger a refetch.

```typescript
useFetchTestCases: (params: { datasetId: string; limit: number; offset: number }) =>
  useClientDataSWR(
    params.datasetId ? [FETCH_TEST_CASES_KEY, params.datasetId, params.limit, params.offset] : null,
    () => agentEvalService.listTestCases(params),
    {
      onSuccess: (data) =>
        set({
          testCaseList: data.data,
          testCaseTotal: data.total,
          isLoadingTestCases: false,
        }),
    },
  );
```

### Pattern 2: Dependent Fetching

Both hooks run in parallel — SWR dedupes, no manual sequencing needed.

```tsx
const BenchmarkDetail = () => {
  const { benchmarkId } = useParams();
  const useFetchBenchmarkDetail = useEvalStore((s) => s.useFetchBenchmarkDetail);
  const useFetchDatasets = useEvalStore((s) => s.useFetchDatasets);

  useFetchBenchmarkDetail(benchmarkId);
  useFetchDatasets(benchmarkId);

  return <div>...</div>;
};
```

### Pattern 3: Conditional Fetching

Pass `undefined` to disable the hook entirely.

```tsx
// only fetch when modal is open AND id present
useFetchDatasetDetail(open && datasetId ? datasetId : undefined);
```

### Pattern 4: Cross-domain Refresh

```typescript
deleteBenchmark: async (id) => {
  await agentEvalService.deleteBenchmark(id);
  await get().refreshBenchmarks();
  await get().refreshDatasets(id); // related cache invalidated too
};
```

---

## Migration Guide: useEffect → Store SWR

### Before (❌ Wrong)

```tsx
const TestCaseList = ({ datasetId }: Props) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    lambdaClient.agentEval.listTestCases
      .query({ datasetId })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [datasetId]);

  return <Table data={data} loading={loading} />;
};
```

### After (✅ Correct)

```typescript
// 1. Add service method
class AgentEvalService {
  async listTestCases(params: { datasetId: string }) {
    return lambdaClient.agentEval.listTestCases.query(params);
  }
}

// 2. Add store slice hook
export const createTestCaseSlice: StateCreator<...> = (set) => ({
  useFetchTestCases: (params) =>
    useClientDataSWR(
      params.datasetId ? [FETCH_TEST_CASES_KEY, params.datasetId] : null,
      () => agentEvalService.listTestCases(params),
      {
        onSuccess: (data) =>
          set({ testCaseList: data.data, isLoadingTestCases: false }),
      },
    ),
});

// 3. Component reads from store
const TestCaseList = ({ datasetId }: Props) => {
  const useFetchTestCases = useEvalStore((s) => s.useFetchTestCases);
  const data = useEvalStore((s) => s.testCaseList);
  const loading = useEvalStore((s) => s.isLoadingTestCases);

  useFetchTestCases({ datasetId });

  return <Table data={data} loading={loading} />;
};
```

---

## Troubleshooting

| Symptom                     | Check                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Data never loads            | Hook called? Key not `null`/`undefined`? Network tab shows request? |
| Stale data after mutation   | Did `refreshXxx` run? Cache key matches what the hook uses?         |
| Loading state stuck `true`  | `onSuccess` writes loading=false? Promise rejected silently?        |
| Detail map missing an entry | Reducer dispatch ran? `isEqual` short-circuited on stale data?      |

---

## Summary Checklist

When adding new data fetching:

### Step 1: Types & State

See `store-data-structures` for details.

- [ ] Define types in `@lobechat/types`: Detail type + List item type
- [ ] State structure: `xxxList: XxxListItem[]`, `xxxDetailMap: Record<string, Xxx>`, `loadingXxxDetailIds: string[]`
- [ ] Reducer if optimistic updates are needed

### Step 2: Service Layer

- [ ] Create service in `src/services/xxxService.ts`
- [ ] Methods: `listXxx()`, `getXxx(id)`, `createXxx()`, `updateXxx()`, `deleteXxx()`

### Step 3: Store Actions

- [ ] `initialState.ts` with state structure
- [ ] `action.ts` with:
  - [ ] `useFetchXxxList()`, `useFetchXxxDetail(id)` — SWR hooks
  - [ ] `refreshXxxList()`, `refreshXxxDetail(id)` — cache invalidation
  - [ ] CRUD methods calling service
  - [ ] `internal_dispatch`, `internal_updateLoading` if using reducer
- [ ] `selectors.ts` (optional but recommended)
- [ ] Integrate slice into main store + initialState

### Step 4: Component Usage

- [ ] Use store hooks (NOT useEffect)
- [ ] Destructure and consume `error` / `mutate`; wrap first-load surfaces in `AsyncBoundary`
      or render `AsyncError` before empty / `NotFound` / zero defaults
- [ ] List pages: access `xxxList` array
- [ ] Detail pages: access `xxxDetailMap[id]`
- [ ] Use loading states for UI feedback
- [ ] Infinite-scroll failures persist as a visible tail Retry row, not a silent `catch`

**Mental model:** Types → Service → Reducer → Slice → Component 🎯

---

## Related Skills

- **`store-data-structures`** — How to structure List and Detail data in stores
- **`zustand`** — General Zustand patterns and best practices
