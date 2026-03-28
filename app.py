# GetF1Data.py
"""
Author: Sean Z. Roberson
This file collects data for the 2025 F1 season into three output files. The FastF1 API is used to access and collect
the data into CSVs, processed as pandas dataframes.

The 2025 season had 24 rounds.

For use for CodeQuantum 2026 at UTSA.

Inputs:
None

Outputs:
QualTimes.csv: Times for all qualifying events. These are loaded as 'Q' in the FastF1 API.
RaceTimes.csv: Full race data, collected by event. These are loaded as 'R' in the FastF1 API.
LapTimes.csv: Lap times for every race.
"""

# Imports.
import fastf1
import pandas as pd

# The needed dataframes will need to be collected first before a union (concatenate) is done at the end.
# This stores every event's information.

qual_dfs = []
race_dfs = []
lap_dfs = []

# Loop over all events.
for event_idx in range(1, 25):
    # First, the qualiyfing event.
    # Load the qualiyfing times to the list qual_dfs.
    session = fastf1.get_session(2025, event_idx, 'Q')
    print(f'Loading qualifying data for event {event_idx}...')
    session.load()
    results = session.results
    # Add columns for the round, race event name, and location.
    results['Round'] = event_idx
    results['Country'] = session.event['Country']
    results['Location'] = session.event['Location']
    results['Event Name'] = session.event['EventName']
    qual_dfs.append(results)

    # Now do the same for the race and lap data.
    session = fastf1.get_session(2025, event_idx, 'R')
    print(f'Loading race data for event {event_idx}...')
    session.load()
    results = session.results
    results['Round'] = event_idx
    results['Country'] = session.event['Country']
    results['Location'] = session.event['Location']
    results['Event Name'] = session.event['EventName']
    race_dfs.append(results)
    
    laps = session.laps
    laps['Round'] = event_idx
    laps['Country'] = session.event['Country']
    laps['Location'] = session.event['Location']
    laps['Event Name'] = session.event['EventName']
    lap_dfs.append(laps)

# Union all the dataframes.
qual = pd.concat(qual_dfs)
race = pd.concat(race_dfs)
laps = pd.concat(lap_dfs)

# Now we combine the race and qualifying data into one table.
keys = ['Round', 'DriverId']
qual_cols = keys + ['Q1', 'Q2', 'Q3']

race = (
    race
    .drop(columns = ['Q1', 'Q2', 'Q3'], errors = "ignore")
    .merge(qual[qual_cols], on = keys, how = "left")
    )

# For non-winners that did not retire or were DQ'd, record the finish time
# (or, in the case of lapped racers, the time they crossed the finish line
# of the last lap after the winner crosses.)
rr = race.copy()
lt = laps.copy()
# Make a laptime delta column.
lt["LapTime_td"] = pd.to_timedelta(lt['LapTime'], errors = "coerce")
# Now sum all the lap times.
lap_sum = (
    lt
    .groupby(['Round', 'DriverNumber'], as_index = False)["LapTime_td"]
    .sum()
    .rename(columns = {"LapTime_td": "LapSum_td"})
)

# Do something similar for the race times.
rr['time_td'] = pd.to_timedelta(rr['Time'], errors = "coerce")
winner_time = (
    rr.loc[rr['Position'] == 1, ['Round', 'time_td']]
    .dropna()
    .drop_duplicates(subset = ['Round'])
    .rename(columns = {'time_td': 'winnertime_td'})
    )

# Join these to the race results table.
rr = rr.merge(winner_time, on = 'Round', how = 'left')
rr = rr.merge(lap_sum, on = ['Round', 'DriverNumber'], how = 'left')

rr["ElapsedTime_td"] = pd.NaT
# The winner's time is already present.
win_mask = rr['Position'] == 1 & rr['winnertime_td'].notna()
rr.loc[win_mask, 'ElapsedTime_td'] = rr.loc[win_mask, 'winnertime_td']

# The times for the finishers.
fin_mask = (
    (rr['Status'] == 'Finished')
    & (rr['Position'] != 1)
    & (rr['winnertime_td'].notna())
    & (rr['time_td'].notna())
    )
rr.loc[fin_mask, 'ElapsedTime_td'] = (
    rr.loc[fin_mask, 'winnertime_td'] + rr.loc[fin_mask, 'time_td']
)

# Use a total lap time for lapped racers.
lap_mask = (rr['Status'] == 'Lapped') & (rr['LapSum_td'].notna())
rr.loc[lap_mask, 'ElapsedTime_td'] = rr.loc[lap_mask, 'LapSum_td']
rr.drop(columns = ['time_td', 'winnertime_td', 'LapSum_td'], inplace = True)
# Reorder so the elapsed time is next to the original time column.
# Same for the qualifier times.
idx = rr.columns.get_loc('Time')
elapsed = rr.pop('ElapsedTime_td')
rr.insert(idx + 1, 'ElapsedTime', elapsed)

# Find position of ElapsedTime
idx = rr.columns.get_loc('ElapsedTime')

# Remove qualifying columns (if present)
qcols = [c for c in ['Q1', 'Q2', 'Q3'] if c in rr.columns]
qual_block = rr[qcols].copy()

rr.drop(columns=qcols, inplace=True)

# Insert them in order after ElapsedTime
for i, col in enumerate(qcols):
    rr.insert(idx + 1 + i, col, qual_block[col])

lt = lt.drop(columns = 'LapTime_td')

# Save the tables.
rr.to_csv('RaceResults.csv', index = False)
lt.to_csv('LapTimes.csv', index = False)

# Also save a parquet copy.
rr.to_parquet('RaceResults.parquet', index = False)
rr.to_parquet('LapTimes.parquet', index = False)