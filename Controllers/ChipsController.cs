using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;

    [ApiController]
    [Route("[controller]")]
    public class ChipsController : ControllerBase
    {
        [HttpGet("standard")]
        public async Task<IActionResult> GetStandardChips()
        {
            var filePath = Path.Combine("wwwroot", "Standard.json");
            if (!System.IO.File.Exists(filePath)) return NotFound("Standard chips data not found.");

            var fileContent = await System.IO.File.ReadAllTextAsync(filePath);
            return Content(fileContent, "application/json");
        }

        [HttpGet("mega")]
        public async Task<IActionResult> GetMegaChips()
        {
            var filePath = Path.Combine("wwwroot", "Mega.json");
            if (!System.IO.File.Exists(filePath)) return NotFound("Mega chips data not found.");

            var fileContent = await System.IO.File.ReadAllTextAsync(filePath);
            return Content(fileContent, "application/json");
        }

        [HttpGet("giga")]
        public async Task<IActionResult> GetGigaChips()
        {
            var filePath = Path.Combine("wwwroot", "Giga.json");
            if (!System.IO.File.Exists(filePath)) return NotFound("Giga chips data not found.");

            var fileContent = await System.IO.File.ReadAllTextAsync(filePath);
            return Content(fileContent, "application/json");
        }
    }
