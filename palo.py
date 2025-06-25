# Consider the following input file which contains JSONS of the following structure:

input2 = [
    {"process_name":"a.exe", "pid":420, "parent_pid":428},
    {"process_name":"c.exe", "pid":428, "parent_pid":None},
    {"process_name":"d.exe", "pid":551, "parent_pid": 420},
    {"process_name":"e.exe", "pid":552, "parent_pid":428},
    {"process_name":"f.exe", "pid":553, "parent_pid":None},
    {"process_name":"g.exe", "pid":4, "parent_pid":553},
    {"process_name":"b.exe", "pid":7, "parent_pid":4},
    {"process_name":"h.exe", "pid":11, "parent_pid":7},
]
names = {x["pid"]: x["process_name"] for x in input2}

def construct_tree(input) -> dict[str, list]:
    res = defaultdict(list)
    for record in input:
        res[record["parent_id"]].append(record["pid"])
    return res

def print_node(pid: int, lvl: int) -> None:
    prefix = "--"
    print(prefix*lvl + names[pid])

# O(n) space
# O(n) time
def print_tree(input: list[dict[str, Any]]) -> None:
    tree = construct_tree(input)  # pid -> list[child.pid]

    stack = [(root_pid, 0) for root_pid in tree[None]]

    while stack:
        pid, lvl = stack.pop()
        print_node(pid, lvl)

        for child in tree[pid]:
            stack.append((child, lvl+1))

if __name__ == '__main__':
    print_tree(input2)


# The program should output the following:
#
# c.exe
# ---- a.exe
# -------- d.exe
# ---- e.exe
# f.exe
# ---- g.exe
# -------- b.exe
# ------------ h.exe