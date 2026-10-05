# CSVs Analyzer for WiGLE for Android

<img width="900" alt="wigle-1" src="https://github.com/user-attachments/assets/19b20439-4561-4ecb-8693-43580255cb65" />
<img width="900" alt="wigle-2" src="https://github.com/user-attachments/assets/ce48cd3d-dc25-400a-8a86-a1639d9f8072" />

> The screenshots are deliberately kept simple for privacy reasons, so as not to publicly display information related to personal networks. Discover the tool by yourself and try it now with one of your CSV files!

## Optimization in progress!
The tool still requires a few improvements.
<br>
Please avoid to import large files (300K+ lines) for now. This may cause loading and performance issues on your web browser.
<br>
<br>
It was successfully tested with a 150,000 lines file, so long "runs" may be imported without issues.
<br>
Just don't import your entire database for now. :)

## Access the tool
To access the tool, [click here.](https://lucasgallone.github.io/WiGLE-CSVs-Analyzer/)
<br>
<br>
Or copy and paste the address below:
<br>
`https://lucasgallone.github.io/WiGLE-CSVs-Analyzer/`

## Presentation & Purposes of this tool
This tool allows you to analyze CSV files containing scan data from the WiGLE for Android app.
<br>
<br>
With a single click, you can view all the networks detected in your CSV file.
<br>
You can view statistics such as the number of encrypted versus open networks, the number of detected manufacturers, and the number of networks using WPS.
<br>
<br>
It is easy to generate statistics regarding the encryption methods used and to obtain information about the manufacturers of the discovered networks.
<br>
<br>
You can track changes to a specific network across multiple scans, such as modifications to its encryption or SSID.
<br>
<br>
An interactive map allows you to clearly visualize network locations and the distribution of Wi-Fi networks across different areas. A built-in triangulation tool helps pinpoint the exact location of a specific network; calculations are based on various reception points and, crucially, the signal strength at those specific locations.
<br>
<br>
The tool includes a technical analysis feature that helps you understand how a network operates, particularly its encryption, and identify potential risks and vulnerabilities.
- - -
> Note: You can import and merge multiple CSV files.

## How to collect your scan reports as CSVs

First, ideally, you will need a WiGLE account.
<br>
<br>
The best practice is to go to the app and select "Database" from the left-hand menu.
<br>Then, tap "CSV Export Run" to export your current scan (do this before uploading it to WiGLE, otherwise the file will reset and you will end up with an empty CSV!) or tap "CSV Export DB" to export your entire database.
> Note about database exports: The file can be very large if you have found a large number of networks.

- - -

The second practice is to [click here](https://wigle.net/uploads) to access your WiGLE uploads on the website, or copy-paste the link below:
<br>
`https://wigle.net/uploads`
<br>
<br>
Then, right-click on the relevant scan session and copy the link. Replace "kml" with "csv" in the link and press Enter.
<br>
The CSV file should then download.
<br>
<br>
However, the issue with this alternative is that the reports lack detail.
<br>
For instance, the file does not distinguish between WPA2 Personal and Enterprise networks. Details regarding encryption algorithms are missing, as is information on WPS status.
<br>
<br>
That is why it is preferable to export your CSV directly from the application.

## Legal notes
This tool was developed solely for educational, analytical, and network security research purposes.
<br>
It in no way encourages connecting to unsecured or poorly secured networks, practices that are entirely contrary to proper wardriving ethics.
<br>
<br>
This project was created by an independent developer with no affiliation to the WiGLE.net team.
<br>
<br>
The WiGLE app collects publicly available information, the kind any device scanning Wi-Fi bands can pick up, without actually connecting to the networks.
<br>
<br>
Please use this tool responsibly. Put it to good use for purely technical, research, or curiosity-driven purposes.
<br>
You could even take the opportunity to let your neighbor know if their network isn't properly secured. They’ll likely appreciate it! :)
