import matplotlib.pyplot as plt
import csv

with open("results.csv", "r") as f:
    reader = csv.reader(f)
    next(reader)  # skip header

    sizes = []
    naive_times = []
    bm_times = []
    kmp_times = []

    for row in reader:
        sizes.append(int(row[0]))
        naive_times.append(float(row[1]))
        bm_times.append(float(row[2]))
        kmp_times.append(float(row[3]))

# Now plot the numeric lists
plt.figure(figsize=(6,4))

plt.plot(sizes, naive_times, label="Naive", marker="o")
plt.plot(sizes, bm_times,    label="Boyer–Moore", marker="s")
plt.plot(sizes, kmp_times,   label="KMP", marker="^")

plt.xscale("log")
plt.yscale("linear")

plt.xlabel("Input Size n")
plt.ylabel("Execution Time (ms)")
plt.title("Substring Search Algorithm Performance")
plt.legend()
plt.tight_layout()
plt.show()
