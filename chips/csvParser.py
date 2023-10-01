import csv
import json

def convert_csv_to_json(input_file, output_file):
    # Read the CSV file
    with open(input_file, 'r', encoding='utf-8') as csv_file:
        csv_reader = csv.DictReader(csv_file)

        # Dictionary to check if an item already exists
        processed_data = {}
        output_data = []

        for row in csv_reader:
            # Handle the case where MId or SId might not exist
            mid = row.get('MId', None)
            sid = row.get('SId', None)

            # Extract the first character of the 'Code' column
            first_character_code = row['Code'][0] if row['Code'] else None

            # Create a unique key for checking if this combination already exists
            unique_key = (sid, mid, row['Name'], row['Description'], row['Element'], row['MB'])

            # If the key already exists, add the new code to the list
            if unique_key in processed_data:
                if first_character_code not in processed_data[unique_key]['Code']:
                    processed_data[unique_key]['Code'].append(first_character_code)
            else:
                processed_row = {
                    'SId': sid,
                    'MId': mid,
                    'Name': row['Name'],
                    'Description': row['Description'],
                    'Damage': row['Damage'],
                    'Code': [first_character_code],  # Store as a list
                    'Element': row['Element'],
                    'Image': row['Image'],
                    'MB': row['MB']
                }
                processed_data[unique_key] = processed_row
                output_data.append(processed_row)

        # Write to a JSON file
        with open(output_file, 'w') as json_file:
            json.dump(output_data, json_file, indent=4)

    print("Conversion completed!")

# Call the function for each input/output file pair
convert_csv_to_json('Giga.csv', 'Giga.json')
convert_csv_to_json('Mega.csv', 'Mega.json')
convert_csv_to_json('Standard.csv', 'Standard.json')