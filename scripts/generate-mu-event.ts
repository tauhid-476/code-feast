import "./load-env";
import { randomInt, randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { figuresStorageConfig } from "@/lib/env";
import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Embedded exact snapshot of "Code Feast - MU" data as fallback
const BACKUP_EVENT_DATA = {
  title: "Code Feast - MU",
  durationMinutes: 90,
  problems: [
    {
      position: 1,
      title: "Two Sum",
      difficulty: "Easy",
      statementMd: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input has exactly one solution, and you may not use the same element twice.

Return the indices in any order.

## Input

- The first line contains an array of integers \`nums\`, separated by spaces.
- The second line contains an integer \`target\`.

## Output

Print two space-separated integers representing the indices of the two elements whose sum equals \`target\`.

## Constraints

- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Exactly one valid answer exists.`,
      starters: [
        {
          language: "python",
          starterCode: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass`,
          harnessCode: `import sys

def main():
    nums = list(map(int, input().split()))
    target = int(input())

    solution = Solution()
    result = solution.twoSum(nums, target)

    print(*result)

if __name__ == "__main__":
    main()`,
        },
        {
          language: "java",
          starterCode: `class Solution {
    public int[] twoSum(int[] nums, int target) {

    }
}`,
          harnessCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        String[] parts = sc.nextLine().trim().split("\\\\s+");
        int[] nums = new int[parts.length];

        for (int i = 0; i < parts.length; i++) {
            nums[i] = Integer.parseInt(parts[i]);
        }

        int target = sc.nextInt();

        Solution solution = new Solution();
        int[] result = solution.twoSum(nums, target);

        System.out.println(result[0] + " " + result[1]);

        sc.close();
    }
}`,
        },
        {
          language: "cpp",
          starterCode: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {

    }
};`,
          harnessCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<int> nums;
    int x, target;

    while (cin >> x) {
        nums.push_back(x);

        if (cin.peek() == '\\n') {
            break;
        }
    }

    cin >> target;

    Solution solution;
    vector<int> result = solution.twoSum(nums, target);

    cout << result[0] << " " << result[1] << endl;

    return 0;
}`,
        },
      ],
      testCases: [
        {
          position: 1,
          input: "2 7 11 15\n9",
          expectedOutput: "0 1",
          variables: [
            { name: "nums", value: "2 7 11 15" },
            { name: "target", value: "9" },
          ],
        },
        {
          position: 2,
          input: "3 2 4\n6",
          expectedOutput: "1 2",
          variables: [
            { name: "nums", value: "3 2 4" },
            { name: "target", value: "6" },
          ],
        },
      ],
      figures: [] as Array<{
        oldId: string;
        storageKey: string;
        contentType: string;
        bytes: number;
        width: number | null;
        height: number | null;
      }>,
    },
    {
      position: 2,
      title: "Invert Binary Tree",
      difficulty: "Easy",
      statementMd: `You are given the root of a binary tree \`root\`. Invert the binary tree and return its root.

**Example 1**

![Figure 1](/api/figures/002ae30c-cc80-4a1f-a5c3-a5d17b8b992b)

\`\`\`code
Input: root = [1,2,3,4,5,6,7]
Output: [1,3,2,7,6,5,4]
\`\`\`

**Example 2**

![Figure 2](/api/figures/bb9a9f51-7f68-452b-a0cd-c75677250ff7)


\`\`\`code 
Input: root = [3,2,1]
Output: [3,1,2]
\`\`\`

**Example 3**
\`\`\`code
Input: root = []
Output: []
\`\`\`

Constraints
- 0 <= number of nodes <= 100
- -100 <= Node.val <= 100
- The tree is a valid binary tree.`,
      starters: [
        {
          language: "python",
          starterCode: `# Definition for a binary tree node.
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right

class Solution:
    def invertTree(self, root):
        pass`,
          harnessCode: `from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def build_tree(values):
    if not values or values[0] == "null":
        return None

    root = TreeNode(int(values[0]))
    queue = deque([root])
    i = 1

    while queue and i < len(values):
        node = queue.popleft()

        if i < len(values) and values[i] != "null":
            node.left = TreeNode(int(values[i]))
            queue.append(node.left)
        i += 1

        if i < len(values) and values[i] != "null":
            node.right = TreeNode(int(values[i]))
            queue.append(node.right)
        i += 1

    return root


def serialize(root):
    if not root:
        return []

    result = []
    queue = deque([root])

    while queue:
        node = queue.popleft()

        if node is None:
            result.append("null")
            continue

        result.append(str(node.val))
        queue.append(node.left)
        queue.append(node.right)

    while result and result[-1] == "null":
        result.pop()

    return result


def main():
    line = input().strip()

    # Handle input such as: root = 4 2 7 1 3 6 9
    if "=" in line:
        line = line.split("=", 1)[1].strip()

    values = line.split()

    root = build_tree(values)

    solution = Solution()
    result = solution.invertTree(root)

    print(" ".join(serialize(result)))


if __name__ == "__main__":
    main()`,
        },
        {
          language: "java",
          starterCode: `class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode(int val) {
        this.val = val;
    }
}

class Solution {
    public TreeNode invertTree(TreeNode root) {

    }
}`,
          harnessCode: `import java.util.*;

public class Main {

    static TreeNode buildTree(String[] values) {
        if (values.length == 0 || values[0].equals("null")) {
            return null;
        }

        TreeNode root = new TreeNode(Integer.parseInt(values[0]));
        Queue<TreeNode> queue = new LinkedList<>();
        queue.add(root);

        int i = 1;

        while (!queue.isEmpty() && i < values.length) {
            TreeNode node = queue.poll();

            if (i < values.length && !values[i].equals("null")) {
                node.left = new TreeNode(Integer.parseInt(values[i]));
                queue.add(node.left);
            }
            i++;

            if (i < values.length && !values[i].equals("null")) {
                node.right = new TreeNode(Integer.parseInt(values[i]));
                queue.add(node.right);
            }
            i++;
        }

        return root;
    }

    static List<String> serialize(TreeNode root) {
        List<String> result = new ArrayList<>();

        if (root == null) return result;

        Queue<TreeNode> queue = new LinkedList<>();
        queue.add(root);

        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();

            if (node == null) {
                result.add("null");
                continue;
            }

            result.add(String.valueOf(node.val));
            queue.add(node.left);
            queue.add(node.right);
        }

        while (!result.isEmpty() &&
               result.get(result.size() - 1).equals("null")) {
            result.remove(result.size() - 1);
        }

        return result;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        String line = sc.nextLine().trim();
        String[] values = line.isEmpty() ? new String[0] : line.split("\\\\s+");

        TreeNode root = buildTree(values);

        Solution solution = new Solution();
        TreeNode result = solution.invertTree(root);

        System.out.println(String.join(" ", serialize(result)));

        sc.close();
    }
}`,
        },
        {
          language: "cpp",
          starterCode: `#include <bits/stdc++.h>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;

    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {

    }
};`,
          harnessCode: `#include <bits/stdc++.h>
using namespace std;

TreeNode* buildTree(vector<string>& values) {
    if (values.empty() || values[0] == "null") {
        return nullptr;
    }

    TreeNode* root = new TreeNode(stoi(values[0]));
    queue<TreeNode*> q;
    q.push(root);

    int i = 1;

    while (!q.empty() && i < values.size()) {
        TreeNode* node = q.front();
        q.pop();

        if (i < values.size() && values[i] != "null") {
            node->left = new TreeNode(stoi(values[i]));
            q.push(node->left);
        }
        i++;

        if (i < values.size() && values[i] != "null") {
            node->right = new TreeNode(stoi(values[i]));
            q.push(node->right);
        }
        i++;
    }

    return root;
}

void serialize(TreeNode* root) {
    if (!root) return;

    vector<string> result;
    queue<TreeNode*> q;
    q.push(root);

    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();

        if (!node) {
            result.push_back("null");
            continue;
        }

        result.push_back(to_string(node->val));
        q.push(node->left);
        q.push(node->right);
    }

    while (!result.empty() && result.back() == "null") {
        result.pop_back();
    }

    for (int i = 0; i < result.size(); i++) {
        if (i > 0) cout << " ";
        cout << result[i];
    }

    cout << endl;
}

int main() {
    string line;
    getline(cin, line);

    stringstream ss(line);
    vector<string> values;
    string value;

    while (ss >> value) {
        values.push_back(value);
    }

    TreeNode* root = buildTree(values);

    Solution solution;
    TreeNode* result = solution.invertTree(root);

    serialize(result);

    return 0;
}`,
        },
      ],
      testCases: [
        {
          position: 1,
          input: "4 2 7 1 3 6 9",
          expectedOutput: "4 7 2 9 6 3 1",
          variables: [{ name: "root", value: "4 2 7 1 3 6 9" }],
        },
        {
          position: 2,
          input: "2 1 3",
          expectedOutput: "2 3 1",
          variables: [{ name: "root", value: "2 1 3" }],
        },
      ],
      figures: [
        {
          oldId: "002ae30c-cc80-4a1f-a5c3-a5d17b8b992b",
          storageKey:
            "problems/35a04d54-6778-4e20-b4a6-e658e684b78e/002ae30c-cc80-4a1f-a5c3-a5d17b8b992b.png",
          contentType: "image/png",
          bytes: 173381,
          width: 1185,
          height: 384,
        },
        {
          oldId: "bb9a9f51-7f68-452b-a0cd-c75677250ff7",
          storageKey:
            "problems/35a04d54-6778-4e20-b4a6-e658e684b78e/bb9a9f51-7f68-452b-a0cd-c75677250ff7.png",
          contentType: "image/png",
          bytes: 71440,
          width: 551,
          height: 279,
        },
      ],
    },
    {
      position: 3,
      title: "Valid Parentheses",
      difficulty: "Easy",
      statementMd: `Given a string \`s\` containing only the characters \`(\`, \`)\`, \`{\`, \`}\`, \`[\` and \`]\`, determine if the input string is valid.

A string is valid if:

1. Every opening bracket is closed by the same type of bracket.
2. Brackets are closed in the correct order.
3. Every closing bracket has a corresponding opening bracket.

## Input

A single string \`s\` containing brackets.

## Output

Print \`true\` if the string is valid, otherwise print \`false\`.

## Constraints

- \`1 <= s.length <= 10^4\`
- \`s\` consists of only \`()[]{}\` characters.`,
      starters: [
        {
          language: "python",
          starterCode: `class Solution:
    def isValid(self, s: str) -> bool:
        pass`,
          harnessCode: `def main():
    s = input().strip()

    solution = Solution()
    result = solution.isValid(s)

    print(str(result).lower())


if __name__ == "__main__":
    main()`,
        },
        {
          language: "java",
          starterCode: `class Solution {
    public boolean isValid(String s) {

    }
}`,
          harnessCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine().trim();

        Solution solution = new Solution();
        boolean result = solution.isValid(s);

        System.out.println(result);

        sc.close();
    }
}`,
        },
        {
          language: "cpp",
          starterCode: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    bool isValid(string s) {

    }
};`,
          harnessCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    string s;
    cin >> s;

    Solution solution;
    bool result = solution.isValid(s);

    cout << (result ? "true" : "false") << endl;

    return 0;
}`,
        },
      ],
      testCases: [
        {
          position: 1,
          input: "()",
          expectedOutput: "true",
          variables: [{ name: "s", value: "()" }],
        },
        {
          position: 2,
          input: "s = ([)]",
          expectedOutput: "false",
          variables: [{ name: "s", value: "s = ([)]" }],
        },
      ],
      figures: [] as Array<{
        oldId: string;
        storageKey: string;
        contentType: string;
        bytes: number;
        width: number | null;
        height: number | null;
      }>,
    },
  ],
};

const JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[randomInt(JOIN_CODE_CHARS.length)];
  }
  return code;
}

async function getUniqueJoinCode(pool: ReturnType<typeof getPool>): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = generateCode();
    const existing = await pool.query(
      `SELECT id FROM events WHERE code = $1 AND status <> 'ended' LIMIT 1`,
      [code],
    );
    if (existing.rowCount === 0) {
      return code;
    }
  }
  throw new Error("Failed to allocate a unique join code.");
}

async function resolveOrganizerId(
  pool: ReturnType<typeof getPool>,
  targetEmail: string,
): Promise<{ id: string; email: string }> {
  try {
    const res = await pool.query(
      `SELECT id, email FROM neon_auth."user" WHERE lower(email) = lower($1) LIMIT 1`,
      [targetEmail],
    );
    if (res.rowCount && res.rows[0]) {
      return { id: res.rows[0].id, email: res.rows[0].email };
    }
  } catch (err) {
    console.warn("Could not query neon_auth.user, using fallback user ID:", (err as Error).message);
  }

  // Fallback to the known user ID for tauheedxd90@gmail.com
  return { id: "6c6d3de6-f224-4856-938a-b950dc75f0f7", email: targetEmail };
}

async function copyS3Figure(
  sourceKey: string,
  destinationKey: string,
): Promise<boolean> {
  const cfg = figuresStorageConfig();
  if (!cfg) return false;

  try {
    const client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
    });

    await client.send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        CopySource: `${cfg.bucket}/${sourceKey}`,
        Key: destinationKey,
      }),
    );
    return true;
  } catch (error) {
    console.warn(`[s3-copy] Warning: Failed to copy figure ${sourceKey} -> ${destinationKey}:`, (error as Error).message);
    return false;
  }
}

async function main() {
  const pool = getPool();
  const targetEmail = process.argv.includes("--email")
    ? process.argv[process.argv.indexOf("--email") + 1]
    : "tauheedxd90@gmail.com";

  console.log(`\n========================================`);
  console.log(` Generating Test Event: "${BACKUP_EVENT_DATA.title}"`);
  console.log(`========================================`);

  const organizer = await resolveOrganizerId(pool, targetEmail);
  console.log(` Organizer: ${organizer.email} (${organizer.id})`);

  const joinCode = await getUniqueJoinCode(pool);
  console.log(` Generated Join Code: ${joinCode}`);

  const eventId = randomUUID();
  const now = new Date();

  // Try to read live data from the existing "Code Feast - MU" in the DB if available
  let eventData = BACKUP_EVENT_DATA;
  try {
    const existingEv = await pool.query(
      `SELECT * FROM events WHERE title = $1 ORDER BY created_at DESC LIMIT 1`,
      ["Code Feast - MU"],
    );
    if (existingEv.rowCount && existingEv.rows[0]) {
      const srcId = existingEv.rows[0].id;
      const probRows = (
        await pool.query(`SELECT * FROM problems WHERE event_id = $1 ORDER BY position`, [srcId])
      ).rows;

      if (probRows.length > 0) {
        const probIds = probRows.map((p) => p.id);
        const starterRows = (
          await pool.query(`SELECT * FROM problem_starters WHERE problem_id = ANY($1)`, [probIds])
        ).rows;
        const testCaseRows = (
          await pool.query(
            `SELECT * FROM test_cases WHERE problem_id = ANY($1) ORDER BY problem_id, position`,
            [probIds],
          )
        ).rows;
        const figureRows = (
          await pool.query(`SELECT * FROM problem_figures WHERE problem_id = ANY($1)`, [probIds])
        ).rows;

        eventData = {
          title: existingEv.rows[0].title,
          durationMinutes: existingEv.rows[0].duration_minutes,
          problems: probRows.map((p) => ({
            position: p.position,
            title: p.title,
            difficulty: p.difficulty,
            statementMd: p.statement_md,
            starters: starterRows
              .filter((s) => s.problem_id === p.id)
              .map((s) => ({
                language: s.language,
                starterCode: s.starter_code,
                harnessCode: s.harness_code,
              })),
            testCases: testCaseRows
              .filter((tc) => tc.problem_id === p.id)
              .map((tc) => ({
                position: tc.position,
                input: tc.input,
                expectedOutput: tc.expected_output,
                variables: tc.variables,
              })),
            figures: figureRows
              .filter((f) => f.problem_id === p.id)
              .map((f) => ({
                oldId: f.id,
                storageKey: f.storage_key,
                contentType: f.content_type,
                bytes: f.bytes,
                width: f.width,
                height: f.height,
              })),
          })),
        };
      }
    }
  } catch (err) {
    console.log("Using embedded backup data for problem set.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert Event
    await client.query(
      `INSERT INTO events (id, title, code, status, duration_minutes, created_by, created_at)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6)`,
      [eventId, eventData.title, joinCode, eventData.durationMinutes, organizer.id, now],
    );

    console.log(` Inserted event "${eventData.title}" [${eventId}] (draft)`);

    // 2. Insert Problems, Starters, Test cases, and Figures
    for (const prob of eventData.problems) {
      const problemId = randomUUID();
      let updatedStatementMd = prob.statementMd;

      const preparedFigures: Array<{
        id: string;
        storageKey: string;
        contentType: string;
        bytes: number;
        width: number | null;
        height: number | null;
      }> = [];

      // Prepare figures for this problem
      if (prob.figures && prob.figures.length > 0) {
        for (const fig of prob.figures) {
          const newFigureId = randomUUID();
          const ext = fig.contentType === "image/png" ? "png" : fig.contentType.split("/")[1] || "png";
          const newStorageKey = `problems/${problemId}/${newFigureId}.${ext}`;

          await copyS3Figure(fig.storageKey, newStorageKey);

          preparedFigures.push({
            id: newFigureId,
            storageKey: newStorageKey,
            contentType: fig.contentType,
            bytes: fig.bytes,
            width: fig.width,
            height: fig.height,
          });

          // Update statement reference to the new figure ID
          updatedStatementMd = updatedStatementMd.replaceAll(
            `/api/figures/${fig.oldId}`,
            `/api/figures/${newFigureId}`,
          );
        }
      }

      // Insert problem first
      await client.query(
        `INSERT INTO problems (id, event_id, position, title, difficulty, statement_md, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [problemId, eventId, prob.position, prob.title, prob.difficulty, updatedStatementMd, now],
      );

      // Now insert figures because problem exists
      for (const fig of preparedFigures) {
        await client.query(
          `INSERT INTO problem_figures (id, problem_id, storage_key, content_type, bytes, width, height, state, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8)`,
          [
            fig.id,
            problemId,
            fig.storageKey,
            fig.contentType,
            fig.bytes,
            fig.width,
            fig.height,
            now,
          ],
        );
      }

      console.log(`   -> Problem ${prob.position}: "${prob.title}" [${problemId}]`);

      // Starters
      for (const starter of prob.starters) {
        await client.query(
          `INSERT INTO problem_starters (id, problem_id, language, starter_code, harness_code)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), problemId, starter.language, starter.starterCode, starter.harnessCode],
        );
      }

      // Test cases
      for (const tc of prob.testCases) {
        await client.query(
          `INSERT INTO test_cases (id, problem_id, position, input, expected_output, variables)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), problemId, tc.position, tc.input, tc.expectedOutput, JSON.stringify(tc.variables)],
        );
      }
    }

    await client.query("COMMIT");

    console.log(`\n Event successfully created!`);
    console.log(`========================================`);
    console.log(` Event Title:  ${eventData.title}`);
    console.log(` Join Code:    ${joinCode}`);
    console.log(` Status:       draft`);
    console.log(` Duration:     ${eventData.durationMinutes} minutes`);
    console.log(` Organizer:    ${organizer.email}`);
    console.log(` Problems:     ${eventData.problems.length} configured`);
    console.log(`----------------------------------------`);
    console.log(` View in Organizer UI:`);
    console.log(`   http://localhost:3000/admin/events/${eventId}`);
    console.log(` Start / Live Controls:`);
    console.log(`   http://localhost:3000/admin/events/${eventId}/live`);
    console.log(` Participant Join URL:`);
    console.log(`   http://localhost:3000/join  (code: ${joinCode})`);
    console.log(`========================================\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to generate event, transaction rolled back:", error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
